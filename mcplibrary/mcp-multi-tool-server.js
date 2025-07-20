// ============================================
// CORRECT FORMAT: mcp-multi-tool-server.js
// Using EXACT format from official MCP documentation
// ============================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';
import { runQuery } from '../standerd-mcp/pgTool.js';


console.log('🎯 [MCP-SERVER] Starting Multi-Tool MCP Server...');

const server = new McpServer({
  name: 'Multi-Tool MCP Server',
  version: '1.0.0',
});

console.log('✅ [MCP-SERVER] Server instance created');

// ============================================
// 🗃️ POSTGRESQL TOOLS - CORRECT FORMAT
// ============================================

console.log('🔧 [MCP-SERVER] Registering PostgreSQL tools...');

// CORRECT FORMAT: Direct property mapping (like official docs)
server.registerTool(
  "execute-sql",
  {
    title: "Execute SQL Query",
    description: "Run a SQL query on the PostgreSQL database",
    inputSchema: {
      query: z.string().describe("The SQL query to execute")
    }
  },
  async ({ query }) => {
    console.log('🔧 [MCP-TOOL] execute-sql called');
    console.log('📝 [MCP-TOOL] Query:', query);
    
    try {
      console.log('⚡ [MCP-TOOL] Calling runQuery()...');
      const results = await runQuery(query);
      console.log('✅ [MCP-TOOL] runQuery() success, rows:', results?.length || 0);
      
      if (Array.isArray(results) && results.length > 0) {
        const headers = Object.keys(results[0]);
        const formattedTable = results.map(row =>
          headers.map(h => row[h]).join(' | ')
        );
        const tableOutput = [headers.join(' | '), ...formattedTable].join('\n');
        
        console.log('📤 [MCP-TOOL] Returning success response');
        return {
          content: [{
            type: "text",
            text: `✅ Query executed successfully! Found ${results.length} rows:\n\n${tableOutput}`
          }]
        };
      } else {
        console.log('📭 [MCP-TOOL] No results returned');
        return {
          content: [{
            type: "text",
            text: "✅ Query executed successfully! No rows returned."
          }]
        };
      }
    } catch (error) {
      console.error('❌ [MCP-TOOL] Error in execute-sql:', error);
      return {
        content: [{
          type: "text",
          text: `❌ SQL Error: ${error.message}`
        }]
      };
    }
  }
);

server.registerTool(
  "list-tables",
  {
    title: "List Database Tables",
    description: "Get a list of all tables in the PostgreSQL database",
    inputSchema: {} // Empty for no parameters
  },
  async () => {
    console.log('🔧 [MCP-TOOL] list-tables called');
    
    try {
      const query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;";
      console.log('⚡ [MCP-TOOL] Calling runQuery()...');
      
      const results = await runQuery(query);
      console.log('✅ [MCP-TOOL] runQuery() success, tables:', results?.length || 0);
      
      const tableNames = results.map(row => row.table_name);
      console.log('📋 [MCP-TOOL] Table names:', tableNames);
      
      return {
        content: [{
          type: "text",
          text: `📚 Available tables (${tableNames.length}):\n${tableNames.map(name => `• ${name}`).join('\n')}`
        }]
      };
    } catch (error) {
      console.error('❌ [MCP-TOOL] Error in list-tables:', error);
      return {
        content: [{
          type: "text",
          text: `❌ Error listing tables: ${error.message}`
        }]
      };
    }
  }
);

server.registerTool(
  "describe-table",
  {
    title: "Describe Table Structure",
    description: "Get column information for a specific table",
    inputSchema: {
      tableName: z.string().describe("Name of the table to describe")
    }
  },
  async ({ tableName }) => {
    console.log('🔧 [MCP-TOOL] describe-table called with:', tableName);
    
    try {
      const query = `
        SELECT column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position;
      `;
      console.log('⚡ [MCP-TOOL] Calling runQuery()...');
      
      const results = await runQuery(query);
      console.log('✅ [MCP-TOOL] runQuery() success, columns:', results?.length || 0);
      
      if (results.length === 0) {
        return {
          content: [{
            type: "text",
            text: `❌ Table '${tableName}' not found.`
          }]
        };
      }
      
      const tableDesc = results.map(col =>
        `${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`
      ).join('\n');
      
      return {
        content: [{
          type: "text",
          text: `📋 Table '${tableName}' structure:\n\n${tableDesc}`
        }]
      };
    } catch (error) {
      console.error('❌ [MCP-TOOL] Error in describe-table:', error);
      return {
        content: [{
          type: "text",
          text: `❌ Error describing table: ${error.message}`
        }]
      };
    }
  }
);

console.log('✅ [MCP-SERVER] PostgreSQL tools registered');

// ============================================
// 🐙 GITHUB TOOLS - CORRECT FORMAT
// ============================================



// ============================================
// 📄 RESOURCES
// ============================================

console.log('🔧 [MCP-SERVER] Registering resources...');

server.registerResource(
  "database-schema",
  "postgres://schema",
  {
    title: "Database Schema",
    description: "Complete PostgreSQL database schema information"
  },
  async () => {
    console.log('📄 [MCP-RESOURCE] database-schema requested');
    
    try {
      const query = `
        SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
      `;
      const results = await runQuery(query);
      console.log('✅ [MCP-RESOURCE] Schema query success');
      
      return {
        contents: [{
          uri: "postgres://schema",
          text: `PostgreSQL Database Schema:\n\n${JSON.stringify(results, null, 2)}`
        }]
      };
    } catch (error) {
      console.error('❌ [MCP-RESOURCE] Schema error:', error);
      return {
        contents: [{
          uri: "postgres://schema",
          text: `❌ Error fetching schema: ${error.message}`
        }]
      };
    }
  }
);

console.log('✅ [MCP-SERVER] Resources registered');

// ============================================
// 💬 PROMPTS
// ============================================

console.log('🔧 [MCP-SERVER] Registering prompts...');

server.registerPrompt(
  "sql-assistant",
  {
    title: "SQL Query Assistant",
    description: "Help write PostgreSQL queries",
    argsSchema: {
      task: z.string().describe("What you want to accomplish with the database"),
      table: z.string().optional().describe("Specific table name (optional)")
    }
  },
  ({ task, table }) => {
    console.log('💬 [MCP-PROMPT] sql-assistant called');
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `I need help writing a PostgreSQL query to: ${task}${table ? `\n\nFocusing on table: ${table}` : ''}\n\nPlease provide a well-formatted SQL query with proper PostgreSQL syntax.`
        }
      }]
    };
  }
);

console.log('✅ [MCP-SERVER] Prompts registered');

// ============================================
// 🚀 START SERVER
// ============================================

async function startServer() {
  try {
    console.log('🎯 [MCP-SERVER] Connecting to transport...');
    
    const transport = new StdioServerTransport();
    console.log('✅ [MCP-SERVER] Transport created');
    
    await server.connect(transport);
    console.log('🚀 [MCP-SERVER] Multi-Tool MCP Server is running!');
    console.log('📋 [MCP-SERVER] Available tools:');
    console.log('   • execute-sql - Run SQL queries');
    console.log('   • list-tables - Show all tables');
    console.log('   • describe-table - Show table structure');
    console.log('   • github-query - Query GitHub API');
    console.log('   • create-github-repo - Create GitHub repository');
    console.log('✅ [MCP-SERVER] Server ready to accept connections!');
    
  } catch (error) {
    console.error('❌ [MCP-SERVER] Failed to start server:', error);
    console.error('🔍 [MCP-SERVER] Stack:', error.stack);
    process.exit(1);
  }
}

// Start the server
startServer();