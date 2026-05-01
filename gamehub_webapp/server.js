const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "gamehub",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || ""
});

app.get("/api/health", async (req, res) => {
  try { await pool.query("SELECT 1"); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ ok: false, message: err.message }); }
});

app.get("/api/users", async (req, res) => {
  const result = await pool.query("SELECT user_id, username, email, country, created_at FROM Users ORDER BY user_id");
  res.json(result.rows);
});

app.get("/api/genres", async (req, res) => {
  const result = await pool.query("SELECT * FROM Genre ORDER BY genre_name");
  res.json(result.rows);
});

app.get("/api/games", async (req, res) => {
  const search = req.query.search || "";
  const genre = req.query.genre || "";
  const onlyFree = req.query.free === "true";
  const params = [`%${search}%`];
  let query = `
    SELECT g.game_id, g.title, g.description, g.release_date, g.base_price, g.is_free,
           g.developer, g.publisher, g.age_rating,
           COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) AS avg_rating,
           COUNT(DISTINCT r.review_id) AS review_count,
           COALESCE(string_agg(DISTINCT ge.genre_name, ', '), 'No genre') AS genres
    FROM Game g
    LEFT JOIN Review r ON g.game_id = r.game_id
    LEFT JOIN Game_Genre gg ON g.game_id = gg.game_id
    LEFT JOIN Genre ge ON gg.genre_id = ge.genre_id
    WHERE LOWER(g.title) LIKE LOWER($1)
  `;
  if (genre) {
    params.push(genre);
    query += ` AND EXISTS (
      SELECT 1 FROM Game_Genre gg2 JOIN Genre ge2 ON gg2.genre_id = ge2.genre_id
      WHERE gg2.game_id = g.game_id AND ge2.genre_name = $${params.length}
    )`;
  }
  if (onlyFree) query += " AND g.is_free = TRUE";
  query += " GROUP BY g.game_id ORDER BY g.game_id";
  const result = await pool.query(query, params);
  res.json(result.rows);
});

app.get("/api/library/:userId", async (req, res) => {
  const result = await pool.query(`
    SELECT u.username, g.game_id, g.title, g.developer, g.base_price, o.acquired_at
    FROM Ownership o
    JOIN Users u ON o.user_id = u.user_id
    JOIN Game g ON o.game_id = g.game_id
    WHERE o.user_id = $1
    ORDER BY o.acquired_at DESC
  `, [req.params.userId]);
  res.json(result.rows);
});

app.get("/api/cart/:userId", async (req, res) => {
  const result = await pool.query(`
    SELECT c.cart_id, g.game_id, g.title, g.base_price, g.is_free
    FROM Cart c
    JOIN Cart_Item ci ON c.cart_id = ci.cart_id
    JOIN Game g ON ci.game_id = g.game_id
    WHERE c.user_id = $1
    ORDER BY g.title
  `, [req.params.userId]);
  res.json(result.rows);
});

app.post("/api/cart/add", async (req, res) => {
  const { user_id, game_id } = req.body;
  const owned = await pool.query("SELECT 1 FROM Ownership WHERE user_id = $1 AND game_id = $2", [user_id, game_id]);
  if (owned.rows.length > 0) return res.status(400).json({ error: "This game is already in your library." });

  const cart = await pool.query("SELECT cart_id FROM Cart WHERE user_id = $1", [user_id]);
  if (cart.rows.length === 0) return res.status(400).json({ error: "User does not have a cart" });

  await pool.query("INSERT INTO Cart_Item (cart_id, game_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [cart.rows[0].cart_id, game_id]);
  await pool.query("UPDATE Cart SET updated_at = CURRENT_TIMESTAMP WHERE cart_id = $1", [cart.rows[0].cart_id]);
  res.json({ ok: true });
});

app.delete("/api/cart/remove", async (req, res) => {
  const { user_id, game_id } = req.body;
  const cart = await pool.query("SELECT cart_id FROM Cart WHERE user_id = $1", [user_id]);
  if (cart.rows.length === 0) return res.status(400).json({ error: "Cart not found" });
  await pool.query("DELETE FROM Cart_Item WHERE cart_id = $1 AND game_id = $2", [cart.rows[0].cart_id, game_id]);
  res.json({ ok: true });
});

app.post("/api/checkout", async (req, res) => {
  const { user_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cartItems = await client.query(`
      SELECT c.cart_id, g.game_id, g.base_price
      FROM Cart c JOIN Cart_Item ci ON c.cart_id = ci.cart_id JOIN Game g ON ci.game_id = g.game_id
      WHERE c.user_id = $1
    `, [user_id]);
    if (cartItems.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cart is empty" });
    }
    const total = cartItems.rows.reduce((sum, item) => sum + Number(item.base_price), 0);
    const order = await client.query("INSERT INTO Orders (user_id, total_amount) VALUES ($1, $2) RETURNING order_id", [user_id, total]);
    for (const item of cartItems.rows) {
      await client.query("INSERT INTO Order_Item (order_id, game_id, price_paid) VALUES ($1, $2, $3)", [order.rows[0].order_id, item.game_id, item.base_price]);
      await client.query("INSERT INTO Ownership (user_id, game_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [user_id, item.game_id]);
    }
    await client.query("DELETE FROM Cart_Item WHERE cart_id = $1", [cartItems.rows[0].cart_id]);
    await client.query("COMMIT");
    res.json({ ok: true, order_id: order.rows[0].order_id, total });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

app.get("/api/orders/:userId", async (req, res) => {
  const result = await pool.query(`
    SELECT o.order_id, o.order_time, o.total_amount, string_agg(g.title, ', ' ORDER BY g.title) AS games
    FROM Orders o JOIN Order_Item oi ON o.order_id = oi.order_id JOIN Game g ON oi.game_id = g.game_id
    WHERE o.user_id = $1
    GROUP BY o.order_id
    ORDER BY o.order_time DESC
  `, [req.params.userId]);
  res.json(result.rows);
});

app.get("/api/reviews", async (req, res) => {
  const result = await pool.query(`
    SELECT r.review_id, u.username, g.title, r.rating, r.review_text, r.created_at
    FROM Review r JOIN Users u ON r.user_id = u.user_id JOIN Game g ON r.game_id = g.game_id
    ORDER BY r.created_at DESC
  `);
  res.json(result.rows);
});

app.post("/api/reviews", async (req, res) => {
  const { user_id, game_id, rating, review_text } = req.body;
  const owns = await pool.query("SELECT 1 FROM Ownership WHERE user_id = $1 AND game_id = $2", [user_id, game_id]);
  if (owns.rows.length === 0) return res.status(400).json({ error: "User must own the game before reviewing it." });

  const result = await pool.query(`
    INSERT INTO Review (user_id, game_id, rating, review_text)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, game_id)
    DO UPDATE SET rating = EXCLUDED.rating, review_text = EXCLUDED.review_text, created_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [user_id, game_id, rating, review_text]);
  res.json(result.rows[0]);
});

app.get("/api/friends/:userId", async (req, res) => {
  const result = await pool.query(`
    SELECT f.friend_id, u.username AS friend_username, f.friends_since
    FROM Friendship f JOIN Users u ON f.friend_id = u.user_id
    WHERE f.user_id = $1 ORDER BY u.username
  `, [req.params.userId]);
  res.json(result.rows);
});

app.get("/api/messages/:userId/:friendId", async (req, res) => {
  const { userId, friendId } = req.params;
  const result = await pool.query(`
    SELECT m.message_id, m.sender_id, m.receiver_id, su.username AS sender, ru.username AS receiver, m.sent_at, m.message_text
    FROM Message m JOIN Users su ON m.sender_id = su.user_id JOIN Users ru ON m.receiver_id = ru.user_id
    WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
    ORDER BY m.sent_at
  `, [userId, friendId]);
  res.json(result.rows);
});

app.post("/api/messages", async (req, res) => {
  const { sender_id, receiver_id, message_text } = req.body;
  const friendship = await pool.query("SELECT 1 FROM Friendship WHERE user_id = $1 AND friend_id = $2", [sender_id, receiver_id]);
  if (friendship.rows.length === 0) return res.status(400).json({ error: "Messages are only allowed between friends." });
  const result = await pool.query("INSERT INTO Message (sender_id, receiver_id, message_text) VALUES ($1, $2, $3) RETURNING *", [sender_id, receiver_id, message_text]);
  res.json(result.rows[0]);
});

app.listen(PORT, () => console.log(`GameHub running at http://localhost:${PORT}`));
