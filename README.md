# 3D Scene with WebSocket Server

This project demonstrates a 3D scene built with Three.js and React Three Fiber, with a WebSocket server for real-time communication.

## Features

- Interactive 3D scene with raycasting
- WebSocket server for real-time communication
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

You need to run both the Next.js application and the WebSocket server:

### 1. Start the WebSocket Server

```bash
npm run server
```

This will start the WebSocket server on port 3001.

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

## Technologies Used

- Next.js
- React
- Three.js
- React Three Fiber
- Socket.IO

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
