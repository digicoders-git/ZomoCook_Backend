const MenuItem = require('../models/MenuItem');

const initialMenuCatalog = [
  // North Indian
  { name: "Paneer Butter Masala", cuisine: "North Indian", category: "Main Course", foodType: "veg", cookingCharge: 240, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=200", isActive: true },
  { name: "Chicken Tikka Masala", cuisine: "North Indian", category: "Main Course", foodType: "non-veg", cookingCharge: 280, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=200", isActive: true },
  { name: "Dal Makhani", cuisine: "North Indian", category: "Main Course", foodType: "veg", cookingCharge: 250, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=200", isActive: true },
  { name: "Samosa", cuisine: "North Indian", category: "Snacks", foodType: "veg", cookingCharge: 120, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=200", isActive: true },
  { name: "Shahi Paneer", cuisine: "North Indian", category: "Main Course", foodType: "veg", cookingCharge: 240, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=200", isActive: true },
  { name: "Poha", cuisine: "North Indian", category: "Breakfast", foodType: "veg", cookingCharge: 110, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=200", isActive: true },
  { name: "Aloo Paratha", cuisine: "North Indian", category: "Breakfast", foodType: "veg", cookingCharge: 130, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=200", isActive: true },
  { name: "Butter Naan", cuisine: "North Indian", category: "Bread", foodType: "veg", cookingCharge: 90, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=200", isActive: true },
  { name: "Tandoori Roti", cuisine: "North Indian", category: "Bread", foodType: "veg", cookingCharge: 70, image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=200", isActive: true },
  { name: "Jeera Rice", cuisine: "North Indian", category: "Rice", foodType: "veg", cookingCharge: 140, image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200", isActive: true },
  { name: "Mix Veg Curry", cuisine: "North Indian", category: "Main Course", foodType: "veg", cookingCharge: 210, image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=200", isActive: true },

  // Chinese
  { name: "Hakka Noodles", cuisine: "Chinese", category: "Main Course", foodType: "veg", cookingCharge: 160, image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=200", isActive: true },
  { name: "Chicken Fried Rice", cuisine: "Chinese", category: "Main Course", foodType: "non-veg", cookingCharge: 200, image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200", isActive: true },
  { name: "Veg Fried Rice", cuisine: "Chinese", category: "Main Course", foodType: "veg", cookingCharge: 180, image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200", isActive: true },
  { name: "Veg Manchurian", cuisine: "Chinese", category: "Main Course", foodType: "veg", cookingCharge: 190, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=200", isActive: true },
  { name: "Spring Rolls", cuisine: "Chinese", category: "Snacks", foodType: "veg", cookingCharge: 150, image: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=200", isActive: true },
  { name: "Chilli Paneer", cuisine: "Chinese", category: "Snacks", foodType: "veg", cookingCharge: 220, image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=200", isActive: true },
  { name: "Honey Chilli Potato", cuisine: "Chinese", category: "Snacks", foodType: "veg", cookingCharge: 170, image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=200", isActive: true },

  // South Indian
  { name: "Idli Sambar", cuisine: "South Indian", category: "Breakfast", foodType: "veg", cookingCharge: 130, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=200", isActive: true },
  { name: "Masala Dosa", cuisine: "South Indian", category: "Breakfast", foodType: "veg", cookingCharge: 150, image: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=200", isActive: true },
  { name: "Medu Vada", cuisine: "South Indian", category: "Breakfast", foodType: "veg", cookingCharge: 140, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=200", isActive: true },
  { name: "Uttapam", cuisine: "South Indian", category: "Breakfast", foodType: "veg", cookingCharge: 140, image: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=200", isActive: true },
  { name: "Curd Rice", cuisine: "South Indian", category: "Rice", foodType: "veg", cookingCharge: 130, image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200", isActive: true },

  // Continental
  { name: "White Sauce Pasta", cuisine: "Continental", category: "Main Course", foodType: "veg", cookingCharge: 220, image: "https://images.unsplash.com/photo-1621996346565-e3d5d6281699?w=200", isActive: true },
  { name: "Garlic Bread with Cheese", cuisine: "Continental", category: "Snacks", foodType: "veg", cookingCharge: 160, image: "https://images.unsplash.com/photo-1619860860774-1e2e17343432?w=200", isActive: true },
  { name: "Grilled Veggies with Herb Rice", cuisine: "Continental", category: "Main Course", foodType: "veg", cookingCharge: 240, image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200", isActive: true },
  { name: "Russian Salad", cuisine: "Continental", category: "Sides", foodType: "veg", cookingCharge: 140, image: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=200", isActive: true },

  // Tandoor & Non-Veg
  { name: "Butter Chicken", cuisine: "North Indian", category: "Main Course", foodType: "non-veg", cookingCharge: 320, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=200", isActive: true },
  { name: "Chicken Biryani", cuisine: "Mughlai", category: "Rice", foodType: "non-veg", cookingCharge: 300, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=200", isActive: true },
  { name: "Chicken Tikka", cuisine: "Tandoor", category: "Starter", foodType: "non-veg", cookingCharge: 190, image: "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=200", isActive: true },
  { name: "Egg Curry", cuisine: "North Indian", category: "Main Course", foodType: "non-veg", cookingCharge: 200, image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=200", isActive: true },
  { name: "Mutton Rogan Josh", cuisine: "Mughlai", category: "Main Course", foodType: "non-veg", cookingCharge: 380, image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=200", isActive: true },

  // Mughlai
  { name: "Mughlai Paneer Korma", cuisine: "Mughlai", category: "Main Course", foodType: "veg", cookingCharge: 260, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=200", isActive: true },
  { name: "Mughlai Dum Biryani", cuisine: "Mughlai", category: "Rice", foodType: "veg", cookingCharge: 240, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=200", isActive: true },
  { name: "Shahi Tukda", cuisine: "Mughlai", category: "Dessert", foodType: "veg", cookingCharge: 150, image: "https://images.unsplash.com/photo-1601303516534-4d1b5d9f2c15?w=200", isActive: true },

  // Punjabi
  { name: "Chole Bhature", cuisine: "Punjabi", category: "Breakfast", foodType: "veg", cookingCharge: 160, image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=200", isActive: true },
  { name: "Sarson Saag & Makki Roti", cuisine: "Punjabi", category: "Main Course", foodType: "veg", cookingCharge: 220, image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=200", isActive: true },
  { name: "Paneer Tikka", cuisine: "Punjabi", category: "Starter", foodType: "veg", cookingCharge: 230, image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=200", isActive: true },
  { name: "Amritsari Kulcha", cuisine: "Punjabi", category: "Bread", foodType: "veg", cookingCharge: 120, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=200", isActive: true },

  // Italian
  { name: "Margherita Pizza", cuisine: "Italian", category: "Snacks", foodType: "veg", cookingCharge: 250, image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200", isActive: true },
  { name: "Pasta Arrabiata (Red Sauce)", cuisine: "Italian", category: "Main Course", foodType: "veg", cookingCharge: 210, image: "https://images.unsplash.com/photo-1621996346565-e3d5d6281699?w=200", isActive: true },
  { name: "Bruschetta", cuisine: "Italian", category: "Snacks", foodType: "veg", cookingCharge: 160, image: "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=200", isActive: true },

  // Mexican
  { name: "Mexican Tacos", cuisine: "Mexican", category: "Snacks", foodType: "veg", cookingCharge: 190, image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200", isActive: true },
  { name: "Veg Quesadilla", cuisine: "Mexican", category: "Snacks", foodType: "veg", cookingCharge: 200, image: "https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=200", isActive: true },
  { name: "Nachos with Salsa & Cheese", cuisine: "Mexican", category: "Snacks", foodType: "veg", cookingCharge: 170, image: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=200", isActive: true },

  // Thai
  { name: "Thai Green Curry with Rice", cuisine: "Thai", category: "Main Course", foodType: "veg", cookingCharge: 260, image: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=200", isActive: true },
  { name: "Pad Thai Noodles", cuisine: "Thai", category: "Main Course", foodType: "veg", cookingCharge: 230, image: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=200", isActive: true },

  // Fast Food
  { name: "Veg Burger", cuisine: "Fast Food", category: "Snacks", foodType: "veg", cookingCharge: 120, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200", isActive: true },
  { name: "French Fries", cuisine: "Fast Food", category: "Snacks", foodType: "veg", cookingCharge: 110, image: "https://images.unsplash.com/photo-1576107232684-1279f3908594?w=200", isActive: true },
  { name: "Veg Grilled Sandwich", cuisine: "Fast Food", category: "Breakfast", foodType: "veg", cookingCharge: 130, image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=200", isActive: true },
  { name: "Pav Bhaji", cuisine: "Fast Food", category: "Snacks", foodType: "veg", cookingCharge: 160, image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=200", isActive: true },

  // Desserts
  { name: "Gulab Jamun", cuisine: "Desserts", category: "Dessert", foodType: "veg", cookingCharge: 120, image: "https://images.unsplash.com/photo-1601303516534-4d1b5d9f2c15?w=200", isActive: true },
  { name: "Rasgulla", cuisine: "Desserts", category: "Dessert", foodType: "veg", cookingCharge: 120, image: "https://images.unsplash.com/photo-1601303516534-4d1b5d9f2c15?w=200", isActive: true },

  // Beverages
  { name: "Cold Coffee", cuisine: "Beverages", category: "Drinks", foodType: "veg", cookingCharge: 90, image: "https://images.unsplash.com/photo-1512568400610-62da28bc8a13?w=200", isActive: true },
  { name: "Fresh Lime Soda", cuisine: "Beverages", category: "Drinks", foodType: "veg", cookingCharge: 80, image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=200", isActive: true }
];

// @desc    Get all menu items (Admin)
// @route   GET /api/menu-items
// @access  Public / Admin
exports.getMenuItems = async (req, res) => {
  try {
    let items = await MenuItem.find({}).sort({ createdAt: -1 });

    // Auto seed if empty
    if (!items || items.length === 0) {
      const count = await MenuItem.countDocuments();
      if (count === 0) {
        await MenuItem.insertMany(initialMenuCatalog);
        items = await MenuItem.find({}).sort({ createdAt: -1 });
      }
    }

    res.status(200).json({
      success: true,
      data: items
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};

// @desc    Get active menu items (For website / app)
// @route   GET /api/menu-items/active
// @access  Public
exports.getActiveMenuItems = async (req, res) => {
  try {
    let items = await MenuItem.find({ isActive: true }).sort({ createdAt: 1 });
    if (!items || items.length === 0) {
      const count = await MenuItem.countDocuments();
      if (count === 0) {
        await MenuItem.insertMany(initialMenuCatalog);
        items = await MenuItem.find({ isActive: true }).sort({ createdAt: 1 });
      }
    }

    res.status(200).json({
      success: true,
      data: items
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};

// @desc    Create new menu item
// @route   POST /api/menu-items
// @access  Admin
exports.createMenuItem = async (req, res) => {
  try {
    const { name, foodType, cuisine, category, cookingCharge, image, isActive } = req.body;

    if (!name || !cuisine || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name, Cuisine and Category are required'
      });
    }

    const item = await MenuItem.create({
      name: name.trim(),
      foodType: foodType === 'non-veg' ? 'non-veg' : 'veg',
      cuisine: cuisine.trim(),
      category: category.trim(),
      cookingCharge: Number(cookingCharge) || 0,
      image: image?.trim() || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=200',
      isActive: isActive !== false
    });

    res.status(201).json({
      success: true,
      data: item,
      message: 'Menu item created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};

// @desc    Update menu item
// @route   PUT /api/menu-items/:id
// @access  Admin
exports.updateMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item,
      message: 'Menu item updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};

// @desc    Delete menu item
// @route   DELETE /api/menu-items/:id
// @access  Admin
exports.deleteMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};

// @desc    Seed / Sync default menu catalog
// @route   POST /api/menu-items/seed
// @access  Admin
exports.seedMenuItems = async (req, res) => {
  try {
    const existing = await MenuItem.find({});
    const existingNames = new Set(existing.map(i => i.name.toLowerCase()));

    const toInsert = initialMenuCatalog.filter(i => !existingNames.has(i.name.toLowerCase()));

    if (toInsert.length > 0) {
      await MenuItem.insertMany(toInsert);
    }

    const allItems = await MenuItem.find({}).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: `Catalog synced. ${toInsert.length} new dishes added. Total: ${allItems.length}`,
      data: allItems
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }
};
