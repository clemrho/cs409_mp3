const request = require('supertest');
const express = require('express');
const router = express.Router();
const app = express();
app.use(express.json());
require('../routes')(app, router);

describe('Task API Endpoints', () => {
  // POST /api/tasks - Create task tests
  it('should create a new task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ name: 'Test Task', deadline: new Date().toISOString() });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message');
    expect(res.body.data).toHaveProperty('name', 'Test Task');
    expect(res.body.data).toHaveProperty('completed', false);
  });

  it('should not create task with missing name', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ deadline: new Date().toISOString() });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('should not create task with missing deadline', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ name: 'Task without deadline' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('should create task with description', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ 
        name: 'Task with description', 
        deadline: new Date().toISOString(),
        description: 'This is a detailed description'
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('description', 'This is a detailed description');
  });

  it('should create task with completed status', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ 
        name: 'Completed task', 
        deadline: new Date().toISOString(),
        completed: true
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('completed', true);
  });

  it('should create task with assigned user', async () => {
    // First create a user
    const userRes = await request(app)
      .post('/api/users')
      .send({ name: 'Test User', email: 'test@example.com' });
    const userId = userRes.body.data._id;

    // Create task assigned to user
    const res = await request(app)
      .post('/api/tasks')
      .send({ 
        name: 'Assigned task', 
        deadline: new Date().toISOString(),
        assignedUser: userId
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('assignedUser', userId);
    expect(res.body.data).toHaveProperty('assignedUserName', 'Test User');
  });

  it('should not create task with invalid assigned user', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ 
        name: 'Task with invalid user', 
        deadline: new Date().toISOString(),
        assignedUser: '507f1f77bcf86cd799439011' // Invalid ObjectId
      });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  // GET /api/tasks - List tasks tests
  it('should get a list of tasks', async () => {
    const res = await request(app)
      .get('/api/tasks');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should filter tasks by where query', async () => {
    // Create a completed task
    await request(app)
      .post('/api/tasks')
      .send({ 
        name: 'Completed filter test', 
        deadline: new Date().toISOString(),
        completed: true
      });

    const res = await request(app)
      .get('/api/tasks')
      .query({ where: JSON.stringify({ completed: true }) });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach(task => {
      expect(task.completed).toBe(true);
    });
  });

  it('should sort tasks by deadline', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .query({ sort: JSON.stringify({ deadline: 1 }) });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should select specific fields', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .query({ select: JSON.stringify({ name: 1, deadline: 1 }) });
    expect(res.statusCode).toBe(200);
    if (res.body.data.length > 0) {
      const task = res.body.data[0];
      expect(task).toHaveProperty('name');
      expect(task).toHaveProperty('deadline');
      expect(task).not.toHaveProperty('description');
    }
  });

  it('should limit number of tasks returned', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .query({ limit: '2' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });

  it('should skip tasks', async () => {
    const allRes = await request(app).get('/api/tasks');
    const skipRes = await request(app)
      .get('/api/tasks')
      .query({ skip: '1' });
    expect(skipRes.statusCode).toBe(200);
    if (allRes.body.data.length > 1) {
      expect(skipRes.body.data.length).toBe(allRes.body.data.length - 1);
    }
  });

  it('should return count of tasks', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .query({ count: 'true' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(typeof res.body.data).toBe('number');
  });

  // GET /api/tasks/:id - Get single task tests
  it('should get a task by id', async () => {
    // Create a task first
    const createRes = await request(app)
      .post('/api/tasks')
      .send({ name: 'Get by id test', deadline: new Date().toISOString() });
    const taskId = createRes.body.data._id;

    const res = await request(app)
      .get(`/api/tasks/${taskId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('_id', taskId);
    expect(res.body.data).toHaveProperty('name', 'Get by id test');
  });

  it('should return 404 for non-existent task', async () => {
    const res = await request(app)
      .get('/api/tasks/507f1f77bcf86cd799439011');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('should select specific fields for single task', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .send({ 
        name: 'Select fields test', 
        deadline: new Date().toISOString(),
        description: 'Test description'
      });
    const taskId = createRes.body.data._id;

    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .query({ select: JSON.stringify({ name: 1, deadline: 1 }) });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('name');
    expect(res.body.data).toHaveProperty('deadline');
    expect(res.body.data).not.toHaveProperty('description');
  });

  // PUT /api/tasks/:id - Update task tests
  it('should update a task', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .send({ name: 'Original name', deadline: new Date().toISOString() });
    const taskId = createRes.body.data._id;
    const newDeadline = new Date(Date.now() + 86400000).toISOString();

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .send({ 
        name: 'Updated name', 
        deadline: newDeadline,
        completed: true
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('name', 'Updated name');
    expect(res.body.data).toHaveProperty('completed', true);
  });

  it('should not update task with missing name', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .send({ name: 'Update test', deadline: new Date().toISOString() });
    const taskId = createRes.body.data._id;

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .send({ deadline: new Date().toISOString() });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('should not update task with missing deadline', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .send({ name: 'Update test', deadline: new Date().toISOString() });
    const taskId = createRes.body.data._id;

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .send({ name: 'Updated name' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('should return 404 when updating non-existent task', async () => {
    const res = await request(app)
      .put('/api/tasks/507f1f77bcf86cd799439011')
      .send({ name: 'Updated', deadline: new Date().toISOString() });
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('should reassign task to different user', async () => {
    // Create two users
    const user1Res = await request(app)
      .post('/api/users')
      .send({ name: 'User One', email: 'user1@example.com' });
    const user2Res = await request(app)
      .post('/api/users')
      .send({ name: 'User Two', email: 'user2@example.com' });
    const userId1 = user1Res.body.data._id;
    const userId2 = user2Res.body.data._id;

    // Create task assigned to user1
    const createRes = await request(app)
      .post('/api/tasks')
      .send({ 
        name: 'Reassignment test', 
        deadline: new Date().toISOString(),
        assignedUser: userId1
      });
    const taskId = createRes.body.data._id;

    // Reassign to user2
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .send({ 
        name: 'Reassignment test',
        deadline: new Date().toISOString(),
        assignedUser: userId2
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('assignedUser', userId2);
    expect(res.body.data).toHaveProperty('assignedUserName', 'User Two');
  });

  it('should unassign task when assignedUser is empty', async () => {
    const userRes = await request(app)
      .post('/api/users')
      .send({ name: 'Test User', email: 'unassign@example.com' });
    const userId = userRes.body.data._id;

    const createRes = await request(app)
      .post('/api/tasks')
      .send({ 
        name: 'Unassign test', 
        deadline: new Date().toISOString(),
        assignedUser: userId
      });
    const taskId = createRes.body.data._id;

    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .send({ 
        name: 'Unassign test',
        deadline: new Date().toISOString(),
        assignedUser: ''
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('assignedUserName', 'unassigned');
  });

  // DELETE /api/tasks/:id - Delete task tests
  it('should delete a task', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .send({ name: 'Delete test', deadline: new Date().toISOString() });
    const taskId = createRes.body.data._id;

    const res = await request(app)
      .delete(`/api/tasks/${taskId}`);
    expect(res.statusCode).toBe(204);

    // Verify task is deleted
    const getRes = await request(app)
      .get(`/api/tasks/${taskId}`);
    expect(getRes.statusCode).toBe(404);
  });

  it('should return 404 when deleting non-existent task', async () => {
    const res = await request(app)
      .delete('/api/tasks/507f1f77bcf86cd799439011');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  it('should remove task from user pendingTasks when deleted', async () => {
    const userRes = await request(app)
      .post('/api/users')
      .send({ name: 'Task owner', email: 'owner@example.com' });
    const userId = userRes.body.data._id;

    const createRes = await request(app)
      .post('/api/tasks')
      .send({ 
        name: 'Task to be deleted', 
        deadline: new Date().toISOString(),
        assignedUser: userId
      });
    const taskId = createRes.body.data._id;

    // Verify task is in user's pendingTasks
    const getUserRes = await request(app)
      .get(`/api/users/${userId}`);
    expect(getUserRes.body.data.pendingTasks).toContain(taskId);

    // Delete task
    await request(app).delete(`/api/tasks/${taskId}`);

    // Verify task is removed from user's pendingTasks
    const getUserRes2 = await request(app)
      .get(`/api/users/${userId}`);
    expect(getUserRes2.body.data.pendingTasks).not.toContain(taskId);
  });

  // Edge cases and additional scenarios
  it('should handle task with very long name', async () => {
    const longName = 'A'.repeat(1000);
    const res = await request(app)
      .post('/api/tasks')
      .send({ name: longName, deadline: new Date().toISOString() });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.name).toBe(longName);
  });

  it('should handle task with empty description', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ 
        name: 'Empty description test', 
        deadline: new Date().toISOString(),
        description: ''
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.description).toBe('');
  });

  it('should handle task with past deadline', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const res = await request(app)
      .post('/api/tasks')
      .send({ name: 'Past deadline', deadline: pastDate });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('deadline');
  });

  it('should handle task with future deadline', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 365).toISOString();
    const res = await request(app)
      .post('/api/tasks')
      .send({ name: 'Future deadline', deadline: futureDate });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('deadline');
  });

  it('should filter tasks by assigned user', async () => {
    const userRes = await request(app)
      .post('/api/users')
      .send({ name: 'Filter user', email: 'filter@example.com' });
    const userId = userRes.body.data._id;

    await request(app)
      .post('/api/tasks')
      .send({ 
        name: 'Filtered task', 
        deadline: new Date().toISOString(),
        assignedUser: userId
      });

    const res = await request(app)
      .get('/api/tasks')
      .query({ where: JSON.stringify({ assignedUser: userId }) });
    expect(res.statusCode).toBe(200);
    res.body.data.forEach(task => {
      expect(task.assignedUser).toBe(userId);
    });
  });

  it('should filter tasks by completion status and assigned user', async () => {
    const userRes = await request(app)
      .post('/api/users')
      .send({ name: 'Complex filter user', email: 'complex@example.com' });
    const userId = userRes.body.data._id;

    await request(app)
      .post('/api/tasks')
      .send({ 
        name: 'Complex filter task', 
        deadline: new Date().toISOString(),
        assignedUser: userId,
        completed: true
      });

    const res = await request(app)
      .get('/api/tasks')
      .query({ 
        where: JSON.stringify({ 
          assignedUser: userId, 
          completed: true 
        }) 
      });
    expect(res.statusCode).toBe(200);
    res.body.data.forEach(task => {
      expect(task.assignedUser).toBe(userId);
      expect(task.completed).toBe(true);
    });
  });
});
