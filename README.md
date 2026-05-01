# 🎮 GameHub – Steam-like Web Application

GameHub is a full-stack web application inspired by Steam, where users can browse games, add them to cart, purchase them, manage their library, write reviews, and interact with friends.

This project was developed as part of a database systems course and demonstrates integration between a PostgreSQL database and a web-based frontend/backend system.

---

## 🚀 Features

- 🔍 Browse and search games
- 🎯 Filter by genre and free games
- 🛒 Add games to cart
- 💳 Checkout and create orders
- 📚 View owned games (Library)
- 📦 View order history
- ⭐ Add and update reviews (only if owned)
- 👥 Friends system
- 💬 Messaging between friends

---

## 🛠 Tech Stack

**Frontend**
- HTML
- CSS
- JavaScript

**Backend**
- Node.js
- Express.js

**Database**
- PostgreSQL (pgAdmin)

---

## 🗂 Project Structure

```text
Gamehub/
├── README.md
└── gamehub_webapp/
    ├── server.js
    ├── package.json
    ├── package-lock.json
    ├── .env.example
    ├── public/
    │   ├── index.html
    │   ├── styles.css
    │   └── app.js
    └── database/
        └── gamehub_real_games_dump.sql
```

---

## ⚙️ Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/mgamre/gamehub-webapp.git
cd gamehub-webapp
```

---

### 2. Setup PostgreSQL Database

1. Open **pgAdmin**
2. Create a database named:

```text
gamehub
```

3. Open **Query Tool**
4. Run:

```text
database/gamehub_real_games_dump.sql
```

This will:
- Create all tables
- Insert 10 users
- Insert 100+ real game titles
- Insert orders, reviews, friends, and messages

---

### 3. Install dependencies

```bash
npm install
```

---

### 4. Configure environment variables

Create a `.env` file in the root directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gamehub
DB_USER=postgres
DB_PASSWORD=your_password_here
PORT=3000
```

---

### 5. Run the application

```bash
npm start
```

---

### 6. Open in browser

```text
http://localhost:3000
```

---

## 🎬 Demo Flow (for presentation)

1. Browse games in Store
2. Search for a game, for example: `Portal` or `Elden Ring`
3. Add a game to Cart
4. Go to Cart and Checkout
5. View Library to confirm the purchased game was added
6. View Orders to confirm order history
7. Add or update a Review
8. Send a Message to a friend

---

## 📊 Database Highlights

- 10 users
- 100+ real game titles
- Fully relational schema with primary keys, foreign keys, and constraints
- Supports:
  - Users ↔ Orders ↔ Games
  - Users ↔ Ownership ↔ Games
  - Users ↔ Reviews ↔ Games
  - Users ↔ Friends ↔ Messages

---


## 👨‍💻 Contributors

- Mihir Gamre
- Sannidhya Deoghare
- Aadritya Singh
- Kshitiz Chaurasia

---


## 🌟 Future Improvements

- User authentication with login and signup
- Payment gateway integration
- Game recommendation system
- Real-time chat using WebSockets
- Wishlist page and friend request management page

---

## 📝 License

This project is for academic purposes only.

