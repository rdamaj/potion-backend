import _ from "lodash";
import { getApp, parameterTypes } from "../../../../helpers/api.js";
import { WALLETS } from "../../../../helpers/constants.js";
import HeliusClient from "../../../../helpers/data/helius-client.js";
import { parseTrades, debug } from "../../../../helpers/data/pnl.js";
const config = {
    type: parameterTypes.none,
    unknownParameters: true,
    connectToDatabase: true,
};

const handler = getApp(async () => {
    const THIRTY_DAYS_AGO = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    const trades = await HeliusClient.getAllWalletTrades('BmzsfqD2PSmEyAMwPiF3hVVeZ39g6pg39GmizVsHaBhk', THIRTY_DAYS_AGO);
    // await debug(trades);
    const solPrice = await HeliusClient.getSolPrice();
    const tradedTokens = await parseTrades(trades, 'BmzsfqD2PSmEyAMwPiF3hVVeZ39g6pg39GmizVsHaBhk', solPrice);
    console.log(tradedTokens);
}, config);

export { handler };
