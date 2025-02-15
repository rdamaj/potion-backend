# potion-backend-template

## Install dependencies
```bash
npm install
```

## Run the functions locally
```bash
cd app/deployments/main
sls invoke local -s local -f walletsSyncJob
sls invoke local -s local -f walletsTradesAPI -p ./wallets/api/.tests/trades.json
```
example `/wallets/api/.tests/trades.json`
```json
{
  "queryStringParameters": {
    "wallet": "suqh5sHtr8HyJ7q8scBimULPkPpA557prMG47xCHQfK",
    "sortBy": "created_at",
    "sortDirection": "DESC"
  }
}
```

# Deploy all functions
```bash
sls deploy -s prod
```

# Deploy each function
```bash
sls deploy -s prod -f walletsSyncJob
sls deploy -s prod -f walletsTradesAPI
```


# Production dependencies
For deploying the serverless productions to a lambda environment you will want to install the dependencies locally in the 'lambda-layer' folder. The generated zip file will be used as an artifact for the lambda layer by the serverless cloud formation template
```bash
cd lambda-layer/nodejs
cp ../../package.json .
npm install --production
cd ..
zip -r layer.zip nodejs
```
Note that the architecture specified in the serverless.yml file should match the desired architecture in production(which should match the architecture of the machine building the layer locally).

## Calling the API in production
The API is deployed to this endpoint:
```bash
https://nsqswzkdpe.execute-api.us-east-1.amazonaws.com/prod/wallets/trades
```

# Design Decisions
- Note that database credentials + helius rpc api key have been hardcoded for convenience and this does not reflect best practices in a production environment.
- The sync job functions by querying parsed transaction history from helius. This endpoint is supposed to have already parsed all transactions for a given address/wallet and summarized them in a way. In reality there were some inconsistencies with how they have indexed this data. 
- To achieve best possible coverage of transaction history, pnl.js attempts to parse the swap information from each transaction in a few different ways. Sometimes this is from the events object helius parses themselves, sometimes from looking at transaction descriptions, sometimes from looking at tokenTransfers and sometimes from accountData/balance changes.
- If I had more time I certainly would have investigated other RPC's to see who can provide the best coverage/consistency. 
- Also If I had more time I did notice that Helius discloses their potential shortcomings in their documentation and note you should use the more native getSignaturesForAddress endpoint to ensure you dont miss any transactions. Personally I find it dissapointing that the market leader has these issues. 
- All in all when comparing wallet data collected to gmgn, there were still a significant amount of transactions excluded. Also I noticed there was just inconsistent behavior in general where sometimes when paginating transaction history I would suddenly not get any more earlier transactions. This was not a rate limit, as the response code was not 429. I simply had to run the jobs again after waiting a bit(the difference between finding 3000 trades vs 100 for a given wallet in 30 days).
- Lastly, I vehemently believe the best approach for a user-facing service is to establish our own indexing mechanism, rather than just relying on querying someone else's past data. I have been working with a live stream of ALL solana dex trades from bitquery.io. They seem to be an excellent choice for a data warehouse in web3 and provide a very nice graphQL interface. I would immediately want to implement this were I to continue working on this project. Even though its not a solution for immediate past data, it is an excellent one for forward collection. 





