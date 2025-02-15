
const WRAPPED_SOL = 'So11111111111111111111111111111111111111112';

const handleSwapEvent = (trade) => {
    const swap = trade.events.swap;
    if(!swap || (!swap.nativeInput && !swap.nativeOutput) || (!swap.tokenInputs && !swap.tokenOutputs)){
        return null;
    }
    const buying = swap.tokenOutputs && swap.tokenOutputs.length > 0;
    const tokenAddress = buying ? 
        swap.tokenOutputs[0]?.mint : 
        swap.tokenInputs[0]?.mint;

    const amount = buying ? 
        Number((parseInt(swap.nativeInput.amount, 10) / 10 ** 9).toFixed(10)) :
        Number((parseInt(swap.nativeOutput.amount, 10) / 10 ** 9).toFixed(10));

    return { tokenAddress, buying, amount };
}

const handleTokenTransfers = (trade, walletAddress) => {
    const transfers = trade.tokenTransfers;
    if(!transfers || !trade.nativeTransfers){
        return null;
    }
    const tokenTransfer = transfers.find(t => t.mint != WRAPPED_SOL);
    const ammAddress = tokenTransfer.fromUserAccount == walletAddress ?
        tokenTransfer.toUserAccount :
        tokenTransfer.fromUserAccount;

    const nativeTransfer = trade.nativeTransfers.find(transfer => 
        transfer.fromUserAccount == ammAddress || 
        transfer.toUserAccount == ammAddress
    );
    const nativeTokenTransfer = trade.tokenTransfers.find(transfer => 
        (transfer.fromUserAccount == ammAddress || 
        transfer.toUserAccount == ammAddress) &&
        transfer.mint == WRAPPED_SOL
    );
    const accountData = trade.accountData.find(data => data.account == ammAddress && data.nativeBalanceChange != null);

    if (nativeTransfer) {
        const buying = tokenTransfer.toUserAccount == walletAddress;
        return {
            tokenAddress: tokenTransfer.mint,
            buying,
            amount: Number((parseInt(nativeTransfer.amount, 10) / 10 ** 9).toFixed(10))
        };
    } else if (nativeTokenTransfer) {
        const buying = tokenTransfer.toUserAccount == walletAddress;
        return {
            tokenAddress: tokenTransfer.mint,
            buying,
            amount: nativeTokenTransfer.tokenAmount
        };
    } else if(accountData){
        const buying = accountData.nativeBalanceChange > 0;
        let nativeAmount = Number((parseInt(accountData.nativeBalanceChange, 10) / 10 ** 9).toFixed(10));
        return {
            tokenAddress: tokenTransfer.mint,
            buying,
            amount: nativeAmount < 0 ? nativeAmount * -1 : nativeAmount
        };
    }

    return null;
}

const parseTrade = (trade, walletAddress, solPrice) => {
    const desc = trade.description;
    if (!desc || !desc.includes('swapped')) {
        return handleTokenTransfers(trade, walletAddress) || handleSwapEvent(trade);
    };

    const matches = desc.match(/^(.*?) swapped ([\d.]+) (.*?) for ([\d.]+) (.*?)$/);
    if (!matches) return null;
    
    const [_, wallet, amount1, asset1, amount2, asset2] = matches;

    const isSolFirst = asset1.trim() === 'SOL';
    const isSolSecond = asset2.trim() === 'SOL';
    const isUSDCFirst = asset1.trim() === 'USDC';
    const isUSDCSecond = asset2.trim() === 'USDC';
    if (!isSolFirst && !isSolSecond && !isUSDCFirst && !isUSDCSecond) return null;

    const buying = isSolFirst || isUSDCFirst;
    const tokenAddress = buying ? asset2 : asset1;
    const usedUSDC = !isSolFirst && !isSolSecond;
    let amount = Number(buying ? amount1 : amount2);
    if(usedUSDC) {
        amount = amount / solPrice;
    }
    return { tokenAddress, buying, amount };
}

const initializeTokenTracking = (tokenAddress, walletAddress) => ({
    id: `${walletAddress}|${tokenAddress}`,
    buys: 0,
    sells: 0,
    wallet: walletAddress,
    token_address: tokenAddress,
    token_name: null,
    first_trade: null,
    last_trade: null,
    transactions: [],
    invested_sol: 0,
    invested_sol_usd: 0,
    realized_pnl: 0,
    realized_pnl_usd: 0,
    roi: 0
});

const updateTradeStats = (tokenData, { buying, amount }) => {
    if (buying) {
        tokenData.buys++;
        tokenData.invested_sol += amount;
        tokenData.realized_pnl -= amount;
    } else {
        tokenData.sells++;
        tokenData.realized_pnl += amount;
    }
}

const updateFinalStats = async (tokenData, solPrice) => {
    tokenData.first_trade = tokenData.transactions[0].timestamp;
    tokenData.last_trade = tokenData.transactions[tokenData.transactions.length - 1].timestamp;
    tokenData.roi = (tokenData.realized_pnl / tokenData.invested_sol) * 100;
    tokenData.token_name = 'Unknown';
    tokenData.invested_sol_usd = tokenData.invested_sol * solPrice;
    tokenData.realized_pnl_usd = tokenData.realized_pnl * solPrice;
    tokenData.roi = tokenData.roi == Infinity || isNaN(tokenData.roi) ? 0 : tokenData.roi;
    if (tokenData.roi >= 10 ** 8 || tokenData.invested_sol_usd >= 10 ** 8 || tokenData.realized_pnl_usd >= 10 ** 8){
        console.log('numeric overflow')
        console.log(tokenData.transactions[0], tokenData.transactions[tokenData.transactions.length - 1]);
    }
    delete tokenData.transactions;
}

export const parseTrades = async (trades, walletAddress, solPrice) => {
    let tradedTokens = {};
    console.log(`parsing ${trades.length} trades for ${walletAddress}`);
    for (const trade of trades) {
        const tradeInfo = parseTrade(trade, walletAddress, solPrice);
        if (!tradeInfo){
            console.log('Unhandled trade type:', trade);
            continue
        }

        const { tokenAddress, buying, amount } = tradeInfo;

        if (!(tokenAddress in tradedTokens)) {
            tradedTokens[tokenAddress] = initializeTokenTracking(tokenAddress, walletAddress);
        }

        updateTradeStats(tradedTokens[tokenAddress], { buying, amount });
        tradedTokens[tokenAddress].transactions.push(trade);
    }

    await Promise.all(
        Object.values(tradedTokens).map(tokenData => 
            updateFinalStats(tokenData, solPrice)
        )
    );
    return tradedTokens;
}