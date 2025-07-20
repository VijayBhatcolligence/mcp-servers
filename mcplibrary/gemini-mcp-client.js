// ============================================
// FILE: gemini-mcp-client.js  
// The Gemini Client (Frontend AI that connects to MCP server)
// ============================================

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('🚀 [GEMINI-CLIENT] Starting Gemini MCP Client...');
console.log('🔑 [GEMINI-CLIENT] API Key configured:', GEMINI_API_KEY ? 'Yes' : 'No');
console.log('📁 [GEMINI-CLIENT] Current directory:', __dirname);

app.use(cors());
app.use(express.json());

// Initialize MCP Client
let mcpClient = null;
let mcpTransport = null;
let isConnected = false;

async function initializeMcpClient() {
  console.log('🔧 [GEMINI-CLIENT] Initializing MCP Client...');
  
  try {
    // Create client instance
    mcpClient = new Client({
      name: "gemini-mcp-client",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {}
      }
    });
    
    console.log('✅ [GEMINI-CLIENT] Client instance created');

    // Create transport to MCP server - using full path to the file in same directory
    const mcpServerPath = path.join(__dirname, 'mcp-multi-tool-server.js');
    console.log('📁 [GEMINI-CLIENT] MCP Server path:', mcpServerPath);
    
    mcpTransport = new StdioClientTransport({
      command: "node",
      args: [mcpServerPath],
      env: process.env
    });
    
    console.log('🔧 [GEMINI-CLIENT] Transport created, connecting to MCP server...');

    // Connect to MCP server
    await mcpClient.connect(mcpTransport);
    isConnected = true;
    console.log('🔗 [GEMINI-CLIENT] Connected to MCP server successfully!');
    
    // List available tools
    try {
      const { tools } = await mcpClient.listTools();
      const toolNames = tools.map(t => t.name);
      
      console.log(`🛠️ [GEMINI-CLIENT] ${toolNames.length} MCP tools available: ${toolNames.join(', ')}`);
    } catch (toolListError) {
      console.error('⚠️ [GEMINI-CLIENT] Could not list tools:', toolListError.message);
    }

    return true;
  } catch (error) {
    console.error('❌ [GEMINI-CLIENT] Failed to initialize MCP client:', error.message);
    console.error('🔍 [GEMINI-CLIENT] Error details:', error.stack);
    isConnected = false;
    return false;
  }
}

// Initialize on startup
initializeMcpClient().then(success => {
  if (success) {
    console.log('✅ [GEMINI-CLIENT] MCP client initialized successfully at startup');
  } else {
    console.error('❌ [GEMINI-CLIENT] Failed to initialize MCP client at startup');
  }
});

async function callGemini(prompt, toolsContext = '') {
  console.log('🤖 [GEMINI-CLIENT] Calling Gemini API...');
  console.log('📝 [GEMINI-CLIENT] Prompt length:', prompt.length);
  
  try {
    const fullPrompt = prompt + (toolsContext ? `\n\n${toolsContext}` : '');
    console.log('📤 [GEMINI-CLIENT] Sending request to Gemini...');
    
    // 📋 LOG: JSON REQUEST TO GEMINI
    const geminiRequestPayload = {
      contents: [{ 
        role: 'user', 
        parts: [{ text: fullPrompt }] 
      }]
    };
    console.log('📋 [FLOW-LOG] JSON REQUEST TO GEMINI:');
    console.log(JSON.stringify(geminiRequestPayload, null, 2));
    
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      geminiRequestPayload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    // 📋 LOG: GEMINI RESPONSE JSON
    console.log('📋 [FLOW-LOG] GEMINI RESPONSE JSON:');
    console.log(JSON.stringify(response.data, null, 2));

    const result = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
    console.log('✅ [GEMINI-CLIENT] Gemini API response received');
    console.log('📝 [GEMINI-CLIENT] Response length:', result.length);
    
    // 📋 LOG: EXTRACTED TEXT FROM GEMINI
    console.log('📋 [FLOW-LOG] EXTRACTED TEXT FROM GEMINI:');
    console.log(result);
    
    return result;
  } catch (error) {
    console.error('❌ [GEMINI-CLIENT] Gemini API Error:', error.message);
    if (error.response) {
      console.error('🔍 [GEMINI-CLIENT] Response status:', error.response.status);
      console.error('🔍 [GEMINI-CLIENT] Response data:', error.response.data);
    }
    throw new Error('Failed to communicate with Gemini API');
  }
}

function formatToolsForPrompt(tools) {
  return tools.map((tool, index) => {
    const params = tool.inputSchema?.properties ? 
      Object.entries(tool.inputSchema.properties).map(([key, value]) => 
        `"${key}": "${value.description || value.type}"`
      ).join(', ') : 'no parameters';
    
    return `${index + 1}. "${tool.name}" - ${tool.description} - Parameters: {${params}}`;
  }).join('\n');
}

// Main chat endpoint
app.post('/chat', async (req, res) => {
  const { prompt } = req.body;
  console.log('\n🔄 [GEMINI-CLIENT] New chat request received');
  console.log('📝 [GEMINI-CLIENT] Prompt:', prompt);
  
  // 📋 LOG: USER REQUEST RECEIVED
  console.log('📋 [FLOW-LOG] 1️⃣ USER REQUEST RECEIVED:');
  console.log(JSON.stringify(req.body, null, 2));
  
  if (!prompt) {
    console.error('❌ [GEMINI-CLIENT] No prompt provided');
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (!GEMINI_API_KEY) {
    console.error('❌ [GEMINI-CLIENT] Gemini API key not configured');
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  try {
    // Ensure MCP client is connected
    if (!isConnected || !mcpClient) {
      console.log('🔄 [GEMINI-CLIENT] MCP client not connected, attempting to reconnect...');
      const initialized = await initializeMcpClient();
      if (!initialized) {
        console.error('❌ [GEMINI-CLIENT] Failed to connect to MCP server');
        return res.status(500).json({ error: 'MCP client not available' });
      }
    }

    // Get available tools dynamically
    console.log('📋 [GEMINI-CLIENT] Fetching available tools dynamically...');
    let tools = [];
    try {
      const toolsResponse = await mcpClient.listTools();
      tools = toolsResponse.tools || [];
      console.log('✅ [GEMINI-CLIENT] Tools fetched successfully:', tools.length);
      console.log('🔧 [GEMINI-CLIENT] Available tools:', tools.map(t => t.name).join(', '));
    } catch (toolsError) {
      console.error('⚠️ [GEMINI-CLIENT] Could not fetch tools:', toolsError.message);
    }

    // If no tools available, go to general conversation
    if (tools.length === 0) {
      console.log('💬 [GEMINI-CLIENT] No tools available, processing as general conversation...');
      
      // 📋 LOG: GENERAL CONVERSATION
      console.log('📋 [FLOW-LOG] 2️⃣ GENERAL CONVERSATION - SENDING TO GEMINI:');
      console.log('Prompt:', prompt);
      
      const answer = await callGemini(prompt);
      console.log('✅ [GEMINI-CLIENT] General conversation completed');
      
      // 📋 LOG: FINAL RESPONSE TO USER
      console.log('📋 [FLOW-LOG] 3️⃣ FINAL RESPONSE TO USER:');
      console.log('Final response:', answer);
      
      return res.json({ response: answer });
    }

    // ============================================
    // 🔧 DYNAMIC TOOL SELECTION
    // ============================================
    console.log('🔧 [GEMINI-CLIENT] Processing request with dynamic tool selection...');
    
    const toolsFormatted = formatToolsForPrompt(tools);
    const toolSelectionPrompt = `
You are an intelligent assistant that can use tools to help users. Based on the user's request, decide whether to use a tool or respond directly.

User request: "${prompt}"

Available tools:
${toolsFormatted}

Instructions:
1. If the user's request can be fulfilled with one of the available tools, respond with EXACTLY this JSON format:
   {
     "type": "tool_use",
     "name": "tool-name",
     "id": "tool-${Date.now()}",
     "input": {
       "param1": "value1",
       "param2": "value2"
     }
   }

2. If no tool is needed or suitable, respond with this JSON format and provide your actual answer:
   {
     "type": "text",
     "text": "Your actual answer to the user's question here"
   }

3. Make sure the tool name matches exactly one of the available tools
4. Include all required parameters in the "input" object as specified in the tool description
5. Use appropriate values for the parameters based on the user's request
6. Always include a unique "id" field with format "tool-{timestamp}"
7. For text responses, provide the actual helpful answer to the user's question, not a placeholder

Choose the most appropriate action:`;

    console.log('🤖 [GEMINI-CLIENT] Getting tool selection decision from Gemini...');
    
    // 📋 LOG: HOST PROCESSING DECISION
    console.log('📋 [FLOW-LOG] 2️⃣ HOST PROCESSING FOR DECISION - SENDING TO GEMINI:');
    console.log('Available tools sent to Gemini:');
    console.log(toolsFormatted);
    
    const toolDecision = await callGemini(toolSelectionPrompt);
    console.log('🔍 [GEMINI-CLIENT] Tool Decision Raw:', toolDecision);
    
    // 📋 LOG: GEMINI DECISION RESPONSE
    console.log('📋 [FLOW-LOG] 3️⃣ GEMINI DECISION RESPONSE:');
    console.log('Decision received from Gemini:', toolDecision);

    try {
      // Clean up the response to extract JSON
      let jsonStr = toolDecision.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }
      
      const decision = JSON.parse(jsonStr);
      console.log('🔧 [GEMINI-CLIENT] Parsed tool decision:', decision);
      
      // 📋 LOG: PARSED DECISION
      console.log('📋 [FLOW-LOG] 3️⃣ PARSED DECISION JSON:');
      console.log(JSON.stringify(decision, null, 2));

      // Check if it's a tool_use type
      if (decision.type === 'tool_use' && decision.name) {
        // Verify tool exists
        const selectedTool = tools.find(t => t.name === decision.name);
        if (!selectedTool) {
          console.error('❌ [GEMINI-CLIENT] Selected tool not found:', decision.name);
          console.log('💬 [GEMINI-CLIENT] Falling back to general conversation...');
        } else {
          console.log('🔧 [GEMINI-CLIENT] Executing selected tool:', decision.name);
          
          // 📋 LOG: TOOL CALL
          console.log('📋 [FLOW-LOG] 4️⃣ CALLING MCP TOOL:');
          console.log('Tool name:', decision.name);
          console.log('Tool ID:', decision.id);
          console.log('Tool arguments:', JSON.stringify(decision.input || {}, null, 2));
          
          const result = await mcpClient.callTool({ 
            name: decision.name, 
            arguments: decision.input || {} 
          });
          console.log('✅ [GEMINI-CLIENT] Tool execution completed');
          
          // 📋 LOG: TOOL RESPONSE
          console.log('📋 [FLOW-LOG] 5️⃣ TOOL RESPONSE RECEIVED:');
          console.log(JSON.stringify(result, null, 2));
          
          // 📋 LOG: SENDING BACK TO GEMINI FOR EXPLANATION
          const explanationPrompt = `User asked: "${prompt}"\n\nTool "${decision.name}" (ID: ${decision.id}) was executed with parameters: ${JSON.stringify(decision.input || {})}\n\nTool result:\n${result.content[0].text}\n\nProvide a helpful explanation of what was accomplished and any relevant details for the user.`;
          console.log('📋 [FLOW-LOG] 6️⃣ SENDING TOOL RESULT TO GEMINI FOR EXPLANATION:');
          console.log('Explanation prompt length:', explanationPrompt.length);
          
          const explanation = await callGemini(explanationPrompt);
          
          // 📋 LOG: FINAL RESPONSE TO USER
          console.log('📋 [FLOW-LOG] 7️⃣ FINAL RESPONSE TO USER:');
          console.log('Final response:', explanation);
          
          return res.json({ response: explanation });
        }
      }
      // Check if it's a direct text response
      else if (decision.type === 'text') {
        console.log('💬 [GEMINI-CLIENT] Gemini chose to respond directly without tools');
        
        // 📋 LOG: DIRECT RESPONSE
        console.log('📋 [FLOW-LOG] 3️⃣ DIRECT RESPONSE FROM GEMINI:');
        console.log('Direct response:', decision.text);
        
        return res.json({ response: decision.text });
      }
      // If Gemini didn't follow the format, treat the whole response as text
      else {
        console.log('💬 [GEMINI-CLIENT] Gemini response not in expected format, using raw response');
        
        // 📋 LOG: RAW RESPONSE
        console.log('📋 [FLOW-LOG] 3️⃣ RAW RESPONSE FROM GEMINI:');
        console.log('Raw response:', toolDecision);
        
        return res.json({ response: toolDecision });
      }
    } catch (parseError) {
      console.log('🔄 [GEMINI-CLIENT] Tool decision parsing failed, trying general conversation');
      console.error('🔍 [GEMINI-CLIENT] Parse error:', parseError.message);
    }

    // ============================================
    // 💬 GENERAL CONVERSATION (Fallback)
    // ============================================
    console.log('💬 [GEMINI-CLIENT] Processing as general conversation...');
    const toolsContext = `Available tools if needed:\n- ${tools.map(t => `${t.name}: ${t.description}`).join('\n- ')}`;
    
    // 📋 LOG: GENERAL CONVERSATION
    console.log('📋 [FLOW-LOG] 2️⃣ GENERAL CONVERSATION - SENDING TO GEMINI:');
    console.log('Prompt with tools context length:', (prompt + '\n\n' + toolsContext).length);
    
    const answer = await callGemini(prompt, toolsContext);
    console.log('✅ [GEMINI-CLIENT] General conversation completed');
    
    // 📋 LOG: FINAL RESPONSE TO USER
    console.log('📋 [FLOW-LOG] 3️⃣ FINAL RESPONSE TO USER:');
    console.log('Final response:', answer);
    
    return res.json({ response: answer });

  } catch (err) {
    console.error('❌ [GEMINI-CLIENT] Error in chat endpoint:', err.message);
    console.error('🔍 [GEMINI-CLIENT] Error stack:', err.stack);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: err.message 
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  console.log('🏥 [GEMINI-CLIENT] Health check requested');
  
  try {
    if (!isConnected || !mcpClient) {
      console.log('⚠️ [GEMINI-CLIENT] MCP client not connected');
      return res.status(503).json({ 
        status: 'MCP client not connected',
        mcpConnected: false,
        geminiConfigured: !!GEMINI_API_KEY
      });
    }
    
    const { tools } = await mcpClient.listTools();
    console.log('✅ [GEMINI-CLIENT] Health check passed');
    
    res.json({ 
      status: 'healthy', 
      mcpConnected: true,
      geminiConfigured: !!GEMINI_API_KEY,
      availableTools: tools.length,
      tools: tools.map(t => t.name)
    });
  } catch (error) {
    console.error('❌ [GEMINI-CLIENT] Health check failed:', error.message);
    res.status(503).json({ 
      status: 'unhealthy', 
      mcpConnected: false,
      geminiConfigured: !!GEMINI_API_KEY,
      error: error.message 
    });
  }
});

// Test endpoint for debugging
app.get('/test-mcp', async (req, res) => {
  console.log('🧪 [GEMINI-CLIENT] MCP test requested');
  
  try {
    if (!isConnected || !mcpClient) {
      const initialized = await initializeMcpClient();
      if (!initialized) {
        return res.status(500).json({ error: 'Cannot connect to MCP server' });
      }
    }
    
    const { tools } = await mcpClient.listTools();
    console.log('✅ [GEMINI-CLIENT] MCP test passed');
    
    res.json({
      message: 'MCP connection test successful',
      tools: tools.map(t => ({ name: t.name, description: t.description }))
    });
  } catch (error) {
    console.error('❌ [GEMINI-CLIENT] MCP test failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 [GEMINI-CLIENT] Shutting down gracefully...');
  if (mcpTransport) {
    console.log('🔌 [GEMINI-CLIENT] Closing MCP transport...');
    try {
      await mcpTransport.close();
      console.log('✅ [GEMINI-CLIENT] MCP transport closed');
    } catch (error) {
      console.error('❌ [GEMINI-CLIENT] Error closing transport:', error.message);
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 [GEMINI-CLIENT] Received SIGTERM, shutting down gracefully...');
  if (mcpTransport) {
    try {
      await mcpTransport.close();
    } catch (error) {
      console.error('❌ [GEMINI-CLIENT] Error closing transport:', error.message);
    }
  }
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 [GEMINI-CLIENT] Server running on http://localhost:${PORT}`);
  console.log(`💬 [GEMINI-CLIENT] Chat endpoint: POST http://localhost:${PORT}/chat`);
  console.log(`🏥 [GEMINI-CLIENT] Health check: GET http://localhost:${PORT}/health`);
  console.log(`🧪 [GEMINI-CLIENT] MCP test: GET http://localhost:${PORT}/test-mcp`);
  console.log(`🔑 [GEMINI-CLIENT] Environment: ${process.env.NODE_ENV || 'development'}`);
});