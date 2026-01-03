# Sports Degens Backend

Backend API for the Sports Degens platform - combining sports betting tools and sweepstakes casino.

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Authentication**: JWT (OAuth to be added later)
- **Payment**: Stripe

## Current Status

### ✅ Implemented
- Core infrastructure (Express, MongoDB, TypeScript)
- Email/password authentication (register, login)
- JWT token generation and validation
- User model with all required fields
- Stripe payment integration structure
- Positive EV calculation service (adapted from existing code)
- Odds API integration
- Sports tools API endpoints
- Tools access middleware

### 🚧 Ready for Implementation
- Additional sports betting tools (structure ready)
- Casino games (scalable structure ready)
- OAuth providers (Discord, Google, Steam)

### 📋 Planned for Later
- WebSocket support
- Redis integration
- GraphQL API
- Testing framework

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your configuration:
```bash
cp .env.example .env
```

3. Required environment variables:
   - `MONGODB_URI` - MongoDB connection string
   - `JWT_SECRET` - Secret for JWT tokens
   - `ODDS_API_KEY` - The Odds API key (for sports tools)
   - `STRIPE_SECRET_KEY` - Stripe secret key
   - `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
   - `PORT` - Server port (default: 3000)
   - `FRONTEND_URL` - Frontend URL for CORS

4. Run in development mode:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Sports Tools (Requires authentication + tools access)
- `GET /api/sports-tools/sports` - Get available sports
- `GET /api/sports-tools/positive-ev` - Get positive EV bets

### Payment (Requires authentication)
- Payment routes structure ready (to be implemented)

### Casino (Requires authentication)
- Casino routes structure ready (to be implemented)

## Project Structure

See `STRUCTURE.md` for detailed structure overview.

## Development

The project uses TypeScript with strict type checking. Make sure to:
- Follow the existing code structure
- Add proper error handling
- Use the logger for debugging
- Write type-safe code

## License

ISC

