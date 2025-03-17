# 3D Scene with WebSocket and MCP Server

This project demonstrates a 3D scene built with Three.js and React Three Fiber, with both a WebSocket server for real-time communication and a Model Context Protocol (MCP) server for AI agent integration.

## Features

- Interactive 3D scene with raycasting
- WebSocket server for real-time communication
- MCP server for AI agent integration (Claude, etc.)
- Connection status indicator
- Ping/pong functionality to test the connection
- Real-time tracking of mouse intersection data
- Server-side storage of current intersection state

## Setup

1. Install dependencies:

```bash
npm install
```

## Running the Application

You need to run both the Next.js application and the server:

### 1. Start the Server

```bash
npm run server
```

This will start both the WebSocket server and MCP server on port 3001.

### 2. Start the Next.js Application

```bash
npm run dev
```

This will start the Next.js application on port 3000.

## Usage

- Open your browser and navigate to `http://localhost:3000`
- The 3D scene will be displayed with a connection status indicator in the top-right corner
- The status indicator shows whether the application is connected to the WebSocket server
- You can click the "Send Ping" button to manually send a ping to the server
- The server will respond with a pong message, and the timestamp will be displayed
- As you move your mouse over the scene, intersection data is sent to the server
- The server tracks what you're pointing at (ground, objects, or nothing)
- The server console will display logs of what the client is currently pointing at

## Intersection Tracking

The application tracks three types of intersections:
1. **Object Intersection**: When the mouse is over a 3D object (box or sphere)
2. **Ground Intersection**: When the mouse is over the ground plane
3. **No Intersection**: When the mouse is not pointing at anything

This data is sent to the server in real-time and stored in the server's memory. The server maintains the current state for each connected client.

## Controls

- Use the mouse to orbit around the scene
- Press the spacebar to reset the camera position
- Mouse over objects to see their coordinates

## Using with Claude Desktop

This project includes an MCP (Model Context Protocol) server that allows Claude to interact with the 3D scene. There are two ways to configure Claude Desktop to use this MCP server:

### Option 1: Direct Connection

1. Make sure the server is running (`npm run server`)

2. Open Claude Desktop and access the settings:
   - On macOS: Click on the Claude menu and select "Settings..."
   - On Windows: Click on the settings icon in the Claude Desktop app

3. Navigate to the "Developer" section and click "Edit Config"

4. Add the following configuration to the JSON file:

```json
{
  "mcpServers": {
    "3d-scene-server": {
      "url": "http://localhost:3001/mcp/sse"
    }
  }
}
```

### Option 2: Using Super Gateway (Recommended)

The Super Gateway provides additional capabilities and security features when connecting Claude Desktop to MCP servers.

1. Make sure the server is running (`npm run server`)

2. Open Claude Desktop and access the settings as described above

3. Add the following configuration to the JSON file:

```json
{
  "mcpServers": {
    "3d-scene-server": {
      "command": "npx",
      "args": [
        "-y",
        "supergateway",
        "--sse",
        "http://localhost:3001/mcp/sse"
      ]
    }
  }
}
```

4. Save the file and restart Claude Desktop

5. When Claude Desktop restarts, it should connect to your MCP server through the Super Gateway. You can verify this by looking for the hammer icon in the Claude interface.

### Troubleshooting Super Gateway Connection

If you encounter issues with the Super Gateway connection, here are some steps to troubleshoot:

1. **Ensure the server is running**: Make sure your server is running with `npm run server` before attempting to connect with Super Gateway.

2. **Try both with and without session ID**: The server is configured to work both with and without a session ID:
   - With session ID: `http://localhost:3001/mcp/sse?sessionId=claude-desktop`
   - Without session ID: `http://localhost:3001/mcp/sse`

3. **Try the direct connection first**: If Super Gateway doesn't work, try the direct connection method (Option 1) to verify that the MCP server itself is working correctly.

4. **Check for connection errors**: If you see errors like:
   - `Error POSTing to endpoint (HTTP 400): {"error":"No active MCP connection"}`
   - `Error POSTing to endpoint (HTTP 400): InternalServerError: stream is not readable`
   - `Error POSTing to endpoint (HTTP 400): {"error":"No active MCP connection for this session"}`
   
   These indicate issues with the SSE connection. Try restarting both the server and Claude Desktop.

5. **Test the connection manually**: You can test the Super Gateway connection manually with:
   ```bash
   npx -y supergateway --sse http://localhost:3001/mcp/sse
   ```
   If successful, you should see a message indicating the Super Gateway is running and connected.

6. **Check server logs**: Look for any error messages in the server console that might indicate what's going wrong.

7. **Verify Node.js version**: Make sure you're using a recent version of Node.js (14+).

8. **Clear npm cache**: If you're still having issues, try clearing the npm cache:
   ```bash
   npm cache clean --force
   ```

9. **Restart your computer**: Sometimes a full system restart can resolve networking issues.

### MCP Capabilities

The MCP server provides the following capabilities to Claude:

#### Resources:
- `scene://current` - Get the current 3D scene state
- `pointer://current` - Get the latest pointer/intersection data

#### Tools:
- `add-object` - Add a new object to the scene
- `remove-object` - Remove an object from the scene
- `update-object` - Update properties of an existing object

Example of asking Claude to use these capabilities:
- "What objects are currently in the 3D scene?"
- "What am I currently pointing at in the scene?"
- "Add a new red sphere to the scene"
- "Remove the box from the scene"
- "Change the color of the sphere to blue"

## Technologies Used

- Next.js
- React
- Three.js
- React Three Fiber
- Socket.IO
- Model Context Protocol (MCP)
- Super Gateway

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
