const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '514e9176-319f-401b-955d-9a3f01ce1b59';
const HELIUS_BASE_URL = `https://api.helius.xyz/v0`;
const HELIUS_RPC_BASE_URL = 'https://mainnet.helius-rpc.com/'

class HeliusClient {
    constructor(apiKey = HELIUS_API_KEY) {
        this.apiKey = apiKey;
        this.requestCount = 0;
    }

    async rateLimit() {
        if (this.requestCount > 0 && this.requestCount % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.requestCount++;
    }

    async makeRequest(url, options = {}) {
        await this.rateLimit();
        let response = null;
        try {
            response = await fetch(url.toString(), options);
            return await response.json();
        } catch (error) {
            return null
        }
    }

    async getWalletTransactions(wallet, options = {}) {
        const {
            until = null,
            before = null,
            limit = 100
        } = options;

        const url = new URL(`${HELIUS_BASE_URL}/addresses/${wallet}/transactions`);
        url.searchParams.append('api-key', this.apiKey);
        url.searchParams.append('type', 'SWAP');
        url.searchParams.append('limit', limit);
        if (until) url.searchParams.append('until', until);
        if (before) url.searchParams.append('before', before);
        return await this.makeRequest(url);
    }

    async getAllWalletTrades(wallet, since) {
        let allTrades = [];
        let before = null;
        
        while (true) {
            const trades = await this.getWalletTransactions(wallet, { before });
            if(trades.error && trades.error.includes('query the API again with')){
                let errorStrings = trades.error.split(' ');
                before = errorStrings[errorStrings.length - 1].replace('.', '');
                continue;
            }
            if (!trades.length) {
                console.log(trades);
                break;
            };
            trades.sort((a, b) => a.timestamp - b.timestamp);
            let tradesAfterCutoff = trades.filter(trade => trade.timestamp > since);
            let reachedCutoff = tradesAfterCutoff.length != trades.length;
            allTrades.push(...tradesAfterCutoff);
            if (reachedCutoff) break;
            before = trades[0].signature;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        allTrades.sort((a, b) => a.timestamp - b.timestamp);
        return allTrades;
    }

    async getTokenMetadata(tokenAddress) {
        const url = `${HELIUS_RPC_BASE_URL}?api-key=${this.apiKey}`;
        const body = JSON.stringify({
            jsonrpc: "2.0",
            method: "getAsset",
            params: {id: tokenAddress, displayOptions: {showFungible: true}},
            id: 'my-id'
        });
        return await this.makeRequest(url, {
            method: "POST",
            body,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async getTokenSymbol(tokenAddress) {
        const metadata = await this.getTokenMetadata(tokenAddress);
        return metadata.result?.token_info?.symbol;
    }

    async getSolPrice() {
        const solMetadata = await this.getTokenMetadata('So11111111111111111111111111111111111111112');
        return solMetadata.result?.token_info?.price_info?.price_per_token;
    }
}

export default new HeliusClient();
