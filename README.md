# Blogify Server API

Backend API for the Blogify blog platform built with Express.js and MongoDB.

## Features

- **Articles**: Full CRUD operations with pagination, search, and filtering
- **Categories**: Category management with article counts
- **Authors**: Author profiles with article tracking
- **Newsletter**: Double opt-in subscription system
- **Contact**: Contact form message handling
- **Search**: Full-text search across articles, categories, and authors
- **Authentication**: JWT-based authentication for admin routes

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the server root directory:
```env
MONGO_URL=your_mongodb_connection_string
PORT=5000
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development

# Cloudinary (optional, for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

3. Seed the database (optional):
```bash
npm run seed
```

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## API Endpoints

### Articles
- `GET /api/articles` - Get all articles (paginated)
- `GET /api/articles/top` - Get top articles
- `GET /api/articles/popular` - Get popular articles
- `GET /api/articles/trending` - Get trending articles
- `GET /api/articles/featured` - Get featured articles
- `GET /api/articles/:slug` - Get article by slug
- `POST /api/articles` - Create article (Admin)
- `PUT /api/articles/:id` - Update article (Admin)
- `DELETE /api/articles/:id` - Delete article (Admin)

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/popular` - Get popular categories
- `GET /api/categories/:slug` - Get category by slug
- `GET /api/categories/:slug/articles` - Get articles by category
- `POST /api/categories` - Create category (Admin)
- `PUT /api/categories/:id` - Update category (Admin)
- `DELETE /api/categories/:id` - Delete category (Admin)

### Authors
- `GET /api/authors` - Get all authors
- `GET /api/authors/:slug` - Get author by slug
- `GET /api/authors/:slug/articles` - Get articles by author
- `POST /api/authors` - Create author (Admin)
- `PUT /api/authors/:id` - Update author (Admin)
- `DELETE /api/authors/:id` - Delete author (Admin)

### Newsletter
- `POST /api/newsletter/subscribe` - Subscribe to newsletter
- `GET /api/newsletter/confirm/:token` - Confirm subscription
- `GET /api/newsletter/unsubscribe/:token` - Unsubscribe
- `GET /api/newsletter/subscribers` - Get all subscribers (Admin)
- `GET /api/newsletter/subscribers/count` - Get subscriber counts (Admin)

### Contact
- `POST /api/contact` - Send contact message
- `GET /api/contact` - Get all messages (Admin)
- `GET /api/contact/:id` - Get message by ID (Admin)
- `PUT /api/contact/:id/read` - Mark as read (Admin)
- `PUT /api/contact/:id/replied` - Mark as replied (Admin)
- `DELETE /api/contact/:id` - Delete message (Admin)
- `GET /api/contact/unread/count` - Get unread count (Admin)

### Search
- `GET /api/search?q=query` - Search articles
- `GET /api/search/categories?q=query` - Search categories
- `GET /api/search/authors?q=query` - Search authors
- `GET /api/search/all?q=query` - Global search

## Authentication

Admin routes require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

Or as a cookie named `token`.

## Database Models

### Article
- Title, slug, excerpt, content
- Category and author references
- Views, likes, read time
- Published status, featured, trending flags
- SEO metadata

### Category
- Name, slug, description
- Color theme
- Popular flag
- Post count

### Author
- Name, slug, bio
- Avatar, email
- Social links
- Article count, total views

### NewsletterSubscription
- Email, token
- Confirmed status
- Unsubscribed status
- Timestamps

### ContactMessage
- Name, email, subject, message
- Read and replied status
- Timestamps

## Error Handling

All errors are handled by the error handler middleware and return JSON responses:

```json
{
  "success": false,
  "message": "Error message"
}
```

## Development Notes

- The server uses MongoDB for data storage
- Text search is enabled on articles (title, excerpt, content)
- Slug generation is automatic for articles, categories, and authors
- Read time is calculated automatically from article content
- Category and author counts are updated automatically when articles are created/updated/deleted

## License

ISC


