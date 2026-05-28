# Miro Clone - Realtime Server

## Mo ta
- Socket.io server dong bo du lieu board theo Yjs (join/leave, update, awareness).
- Xac thuc ket noi bang JWT Supabase (ES256 qua JWKS, HS256 qua secret).
- Quan ly room va awareness cho tung board.

## Stack cong nghe
- Node.js, TypeScript
- Socket.io
- Yjs + y-protocols
- jsonwebtoken, jwks-rsa
- dotenv

## Cau hinh moi truong
- Tao [realtime-server/.env](realtime-server/.env) va dien cac bien sau.

| Bien | Ghi chu |
| --- | --- |
| `PORT` | Cong port, mac dinh 4000 |
| `CLIENT_URL` | CORS origin, mac dinh http://localhost:3000 |
| `SUPABASE_URL` | Bat buoc khi xac thuc ES256/JWKS |
| `SUPABASE_JWT_SECRET` | Bat buoc khi xac thuc HS256 |

## Cach chay
- Chay lenh duoi day trong thu muc [realtime-server](realtime-server).
- Cai dat: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`

## Ket noi tu frontend
- Dam bao `NEXT_PUBLIC_SOCKET_URL` tro toi dia chi server (vi du http://localhost:4000).
