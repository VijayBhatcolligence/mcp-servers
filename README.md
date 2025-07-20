# MCP Multi-Tool Server Setup Guide

## 1. Clone the repository
```shell
git clone https://github.com/VijayBhatcolligence/mcp-servers.git
cd mcp-servers
```

## 2. Install dependencies
Run the following command to install npm dependencies (after you confirm or update your package.json):
```shell
npm install
```

If you do not have a package.json, initialize one:
```shell
npm init -y
```
Then install the needed packages, for example:
```shell
npm install express dotenv pg
```
Add any other dependencies required by your code.

## 3. Configure environment variables
Create a `.env` file in the root directory, using this template:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
DB_USER=""
DB_PASSWORD=""
DB_HOST=localhost
DB_PORT=5432
DB_NAME=""
GEMINI_API_KEY=""
MCP_SERVER_PATH=mcp-multi-tool-server.js

# Server Configuration
PORT=3000
NODE_ENV=development
```

## 4. Run the server
```shell
node mcp-multi-tool-server.js
```

## 5. Test with MCP Inspector
You can test the server using MCP Inspector:
```shell
npx @modelcontextprotocol/inspector node mcp-multi-tool-server.js
```

The main server file is `mcp-multi-tool-server.js`. The server can be tested and inspected with MCP Inspector.add .env in standerd-mcp folder also 

---

If you need the exact dependencies, please provide your package.json or specify the main frameworks and libraries used.
