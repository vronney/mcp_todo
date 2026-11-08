import { createServer } from 'node:https';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { z } from "zod";

function createTodoServer() {
    const server = new McpServer({ name: "todo-app", version: "0.1.0" });;
    
    server.registerTool(
        "add_todo",
        {
            title: 'Add todo',
            description: 'Create a todo item with the given title',
            inputSchema: addTodoInputSchema,
            _meta: {
                'openai/toolInvocation/invoking': 'Adding todo',
                'openai/toolInvocation/invoked': 'Added todo',
            },
        },
        async (args) => {
            const title = args?.title?.trim?.() ?? '';
            if (!title) return replyWithTodos('Missing title.');
            const todo = { id: `todo-${nextId++}`, title, completed: false };
            todos = [...todos, todo];
            return replyWithTodos(`${todo.title}`);
        }
    );
    
    server.registerTool(
        'list_todos',
        {
            title: 'List todos',
            description: 'Lists all todo items.',
            _meta: {
            'openai/toolInvocation/invoking': 'Listing todos',
            'openai/toolInvocation/invoked': 'Listed todos',
            },
        },
        async () => {
            return replyWithTodos();
        },
    );
    
    server.registerTool(
        'complete_todo',

        {
            title: 'Complete todo',
            description: 'Marks a todo as done by id.',
            inputSchema: completeTodoInputSchema,
            _meta: {
                'openai/toolInvocation/invoking': 'Completing todo',
                'openai/toolInvocation/invoked': 'Completed todo',
            },
        },

        async (args) => {
            const id = args?.id;
            if (!id) return replyWithTodos('Missing todo id.');
            const todo = todos.find((task) => task.id === id);
            if (!todo) {
                return replyWithTodos(`Todo ${id} was not found.`);
            }
            todos = todos.map((task) =>
                task.id === id ? { ...task, completed: true } : task,
            );
            return replyWithTodos(`Completed "${todo.title}".`);
        },
    );
    
    return server;
};

let todos = [];
let nextId = 1;

const addTodoInputSchema = {
    title: z.string().min(1),
};

const replyWithTodos = (message) => ({
    content: message ? [{ type: 'text', text: message }] : [],
    structuredContent: { tasks: todos },
});

const completeTodoInputSchema = {
    id: z.string().min(1),
};

const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = '/mcp';

const httpServer = createServer(async (req, res) => {
    if (!req.url) {
        res.writeHead(400).end('Missing URL');
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

    // handle the options call for the endpoint
    if (req.method === 'OPTIONS' && url.pathname === MCP_PATH) {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'content-type, mcp-session-id',
            'Access-Control-Expose-Headers': 'Mcp-Session-Id',
        });
        res.end();
        return;
    }

    // handles normal get method for the main link
    if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/plain' }).end('Todo MCP server');
        return;
    }
    // here you are handling your MCP calls with streamable HTTP
    const MCP_METHODS = new Set(['POST', 'GET', 'DELETE']);
    if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
        const server = createTodoServer();
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // stateless mode
            enableJsonResponse: true,
        });
        res.on('close', () => {
            transport.close();
            server.close();
        });
        try {
            await server.connect(transport);
            await transport.handleRequest(req, res);
        } catch (error) {
            console.error('Error handling MCP request:', error);
            if (!res.headersSent) {
                res.writeHead(500).end('Internal server error');
            }
        }
        return;
    }
    res.writeHead(404).end('Not Found');
});

httpServer.listen(port, () => {
    console.log(
        `Todo MCP server listening on http://localhost:${port}${MCP_PATH}`,
    );
});
