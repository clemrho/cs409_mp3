var User = require('../models/user');
var Task = require('../models/task');

module.exports = function (router) {
    // Users endpoint
    var usersRoute = router.route('/users');
    var userIdRoute = router.route('/users/:id');

    usersRoute.get(async function (req, res) {
        try {
            let query = User.find();
            
            // Handle query parameters
            if (req.query.where) query = query.where(JSON.parse(req.query.where));
            if (req.query.sort) query = query.sort(JSON.parse(req.query.sort));
            if (req.query.select) query = query.select(JSON.parse(req.query.select));
            if (req.query.skip) query = query.skip(parseInt(req.query.skip));
            if (req.query.limit) query = query.limit(parseInt(req.query.limit));
            
            if (req.query.count === 'true') {
                const count = await query.countDocuments();
                return res.status(200).json({
                    message: 'Count of users retrieved successfully',
                    data: count
                });
            }

            const users = await query.exec();
            res.status(200).json({
                message: 'Users retrieved successfully',
                data: users
            });
        } catch (err) {
            res.status(500).json({
                message: 'Error retrieving users',
                data: err.message
            });
        }
    });

    usersRoute.post(async function (req, res) {
        try {
            if (!req.body.name || !req.body.email) {
                return res.status(400).json({
                    message: 'Name and email are required',
                    data: null
                });
            }

            const existingUser = await User.findOne({ email: req.body.email });
            if (existingUser) {
                return res.status(400).json({
                    message: 'A user with this email already exists',
                    data: null
                });
            }

            const user = new User(req.body);
            const savedUser = await user.save();
            res.status(201).json({
                message: 'User created successfully',
                data: savedUser
            });
        } catch (err) {
            res.status(500).json({
                message: 'Error creating user',
                data: err.message
            });
        }
    });

    userIdRoute.get(async function (req, res) {
        try {
            let query = User.findById(req.params.id);
            
            if (req.query.select) {
                query = query.select(JSON.parse(req.query.select));
            }

            const user = await query.exec();
            if (!user) {
                return res.status(404).json({
                    message: 'User not found',
                    data: null
                });
            }

            res.status(200).json({
                message: 'User retrieved successfully',
                data: user
            });
        } catch (err) {
            res.status(500).json({
                message: 'Error retrieving user',
                data: err.message
            });
        }
    });

    userIdRoute.put(async function (req, res) {
        try {
            if (!req.body.name || !req.body.email) {
                return res.status(400).json({
                    message: 'Name and email are required',
                    data: null
                });
            }

            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({
                    message: 'User not found',
                    data: null
                });
            }

            // Check if email is being changed and if it's already in use
            if (req.body.email !== user.email) {
                const existingUser = await User.findOne({ email: req.body.email });
                if (existingUser) {
                    return res.status(400).json({
                        message: 'A user with this email already exists',
                        data: null
                    });
                }
            }

            // Update user's tasks if pendingTasks array has changed
            if (req.body.pendingTasks) {
                // Find tasks that are being added to this user but are currently assigned to other users
                const tasksToTransfer = await Task.find({
                    _id: { $in: req.body.pendingTasks },
                    assignedUser: { $ne: user._id, $ne: '' }
                });

                // Remove these tasks from their old users' pendingTasks
                for (const task of tasksToTransfer) {
                    if (task.assignedUser) {
                        await User.findByIdAndUpdate(
                            task.assignedUser,
                            { $pull: { pendingTasks: task._id } }
                        );
                    }
                }

                // Remove user from old tasks not in new list
                await Task.updateMany(
                    { 
                        _id: { $in: user.pendingTasks },
                        _id: { $nin: req.body.pendingTasks }
                    },
                    { 
                        assignedUser: '',
                        assignedUserName: 'unassigned'
                    }
                );

                // Update new tasks with user info
                await Task.updateMany(
                    { _id: { $in: req.body.pendingTasks } },
                    { 
                        assignedUser: user._id,
                        assignedUserName: req.body.name
                    }
                );
            }

            const updatedUser = await User.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true }
            );

            res.status(200).json({
                message: 'User updated successfully',
                data: updatedUser
            });
        } catch (err) {
            res.status(500).json({
                message: 'Error updating user',
                data: err.message
            });
        }
    });

    userIdRoute.delete(async function (req, res) {
        try {
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({
                    message: 'User not found',
                    data: null
                });
            }

            // Unassign all tasks assigned to this user
            await Task.updateMany(
                { assignedUser: req.params.id },
                { 
                    assignedUser: '',
                    assignedUserName: 'unassigned'
                }
            );

            await User.findByIdAndDelete(req.params.id);
            res.status(204).send();
        } catch (err) {
            res.status(500).json({
                message: 'Error deleting user',
                data: err.message
            });
        }
    });

    // Tasks endpoint
    var tasksRoute = router.route('/tasks');
    var taskIdRoute = router.route('/tasks/:id');

    tasksRoute.get(async function (req, res) {
        try {
            let query = Task.find();
            
            // Handle query parameters
            if (req.query.where) query = query.where(JSON.parse(req.query.where));
            if (req.query.sort) query = query.sort(JSON.parse(req.query.sort));
            if (req.query.select) query = query.select(JSON.parse(req.query.select));
            if (req.query.skip) query = query.skip(parseInt(req.query.skip));
            if (req.query.limit) query = query.limit(parseInt(req.query.limit || 100));
            
            if (req.query.count === 'true') {
                const count = await query.countDocuments();
                return res.status(200).json({
                    message: 'Count of tasks retrieved successfully',
                    data: count
                });
            }

            const tasks = await query.exec();
            res.status(200).json({
                message: 'Tasks retrieved successfully',
                data: tasks
            });
        } catch (err) {
            res.status(500).json({
                message: 'Error retrieving tasks',
                data: err.message
            });
        }
    });

    tasksRoute.post(async function (req, res) {
        try {
            if (!req.body.name || !req.body.deadline) {
                return res.status(400).json({
                    message: 'Name and deadline are required',
                    data: null
                });
            }

            const task = new Task(req.body);
            
            // If task is assigned to a user
            if (req.body.assignedUser) {
                const user = await User.findById(req.body.assignedUser);
                if (!user) {
                    return res.status(400).json({
                        message: 'Assigned user not found',
                        data: null
                    });
                }
                task.assignedUserName = user.name;
                
                // Add task to user's pendingTasks
                user.pendingTasks.push(task._id);
                await user.save();
            }

            const savedTask = await task.save();
            res.status(201).json({
                message: 'Task created successfully',
                data: savedTask
            });
        } catch (err) {
            res.status(500).json({
                message: 'Error creating task',
                data: err.message
            });
        }
    });

    taskIdRoute.get(async function (req, res) {
        try {
            let query = Task.findById(req.params.id);
            
            if (req.query.select) {
                query = query.select(JSON.parse(req.query.select));
            }

            const task = await query.exec();
            if (!task) {
                return res.status(404).json({
                    message: 'Task not found',
                    data: null
                });
            }

            res.status(200).json({
                message: 'Task retrieved successfully',
                data: task
            });
        } catch (err) {
            res.status(500).json({
                message: 'Error retrieving task',
                data: err.message
            });
        }
    });

    taskIdRoute.put(async function (req, res) {
        try {
            if (!req.body.name || !req.body.deadline) {
                return res.status(400).json({
                    message: 'Name and deadline are required',
                    data: null
                });
            }

            const task = await Task.findById(req.params.id);
            if (!task) {
                return res.status(404).json({
                    message: 'Task not found',
                    data: null
                });
            }

            // Handle user assignment changes
            if (req.body.assignedUser !== task.assignedUser) {
                // Remove task from old user's pendingTasks
                if (task.assignedUser) {
                    await User.findByIdAndUpdate(
                        task.assignedUser,
                        { $pull: { pendingTasks: task._id } }
                    );
                }

                // Add task to new user's pendingTasks
                if (req.body.assignedUser) {
                    const newUser = await User.findById(req.body.assignedUser);
                    if (!newUser) {
                        return res.status(400).json({
                            message: 'Assigned user not found',
                            data: null
                        });
                    }
                    req.body.assignedUserName = newUser.name;
                    newUser.pendingTasks.push(task._id);
                    await newUser.save();
                } else {
                    req.body.assignedUserName = 'unassigned';
                }
            }

            const updatedTask = await Task.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true }
            );

            res.status(200).json({
                message: 'Task updated successfully',
                data: updatedTask
            });
        } catch (err) {
            res.status(500).json({
                message: 'Error updating task',
                data: err.message
            });
        }
    });

    taskIdRoute.delete(async function (req, res) {
        try {
            const task = await Task.findById(req.params.id);
            if (!task) {
                return res.status(404).json({
                    message: 'Task not found',
                    data: null
                });
            }

            // Remove task from assigned user's pendingTasks
            if (task.assignedUser) {
                await User.findByIdAndUpdate(
                    task.assignedUser,
                    { $pull: { pendingTasks: task._id } }
                );
            }

            await Task.findByIdAndDelete(req.params.id);
            res.status(204).send();
        } catch (err) {
            res.status(500).json({
                message: 'Error deleting task',
                data: err.message
            });
        }
    });

    return router;
}
