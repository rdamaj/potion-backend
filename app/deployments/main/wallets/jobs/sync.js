import _ from "lodash";
import { getApp, parameterTypes } from "../../../../helpers/api.js";
import { WALLETS } from "../../../../helpers/constants.js";
import HeliusClient from "../../../../helpers/data/helius-client.js";
import { parseTrades, debug } from "../../../../helpers/data/pnl.js";
import { upsertMany } from "../../../../helpers/data/postgres-helper.js";

const config = {
    type: parameterTypes.none,
    unknownParameters: true,
    connectToDatabase: true,
};

const handler = getApp(async () => {
    const THIRTY_DAYS_AGO = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    const solPrice = await HeliusClient.getSolPrice();
    for (const wallet of WALLETS.slice(20,30)) {
        try{
            const trades = await HeliusClient.getAllWalletTrades(wallet, THIRTY_DAYS_AGO);
            const tradedTokens = await parseTrades(trades, wallet, solPrice);
            const tradesArray = Object.values(tradedTokens);
            if(tradesArray.length > 0){
                let result = await upsertMany('trades', tradesArray, ['id']);
                if(result){
                    console.log(`Synced ${tradesArray.length} trades for wallet ${wallet}`);
                }
            } else {
                console.log(`No trades found for wallet ${wallet}`);
            }
        } catch(e){
            console.error(`Error syncing wallet ${wallet}: ${e}`);
        }
    }
}, config);

export { handler };
