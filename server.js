import { createServer } from 'node:https';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

const httpServer = createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }
  
  const url = new URL(req.url, `https://${req.headers.host ?? "localhost"}`);
  
  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`Todo MCP server listening on https://localhost:${port}, press Ctrl+C to stop`);
});
