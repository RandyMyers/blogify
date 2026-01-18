const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/users');
const bcrypt = require('bcryptjs');

// Import app (we'll need to export it from app.js)
// For now, we'll create a test app setup

describe('Auth Controller', () => {
  let app;
  let testUser;

  beforeAll(async () => {
    // Import app after database connection
    app = require('../app');
    
    // Create test admin user
    const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
    testUser = await User.create({
      email: 'testadmin@blogify.com',
      password: hashedPassword,
      username: 'testadmin',
      role: 'admin',
      emailVerified: true
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testadmin@blogify.com',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('testadmin@blogify.com');
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testadmin@blogify.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testadmin@blogify.com',
          password: 'WrongPassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject non-admin users', async () => {
      // Create non-admin user
      const hashedPassword = await bcrypt.hash('UserPassword123!', 12);
      const regularUser = await User.create({
        email: 'user@blogify.com',
        password: hashedPassword,
        username: 'regularuser',
        role: 'affiliate'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@blogify.com',
          password: 'UserPassword123!'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Admin access required');

      await User.findByIdAndDelete(regularUser._id);
    });
  });
});


