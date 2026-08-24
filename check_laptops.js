const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Asset = mongoose.model('Asset', new mongoose.Schema({}, { strict: false }));
    const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }));

    const categories = await Category.find({});
    const catMap = {};
    categories.forEach(c => { catMap[c._id.toString()] = c.name; });

    const laptops = await Asset.find({
      name: { $regex: /لاب|laptop|zbook|thinkpad|precision|elitebook|macbook/i }
    });

    console.log(`=== TOTAL LAPTOPS FOUND: ${laptops.length} ===`);
    const breakdown = {};
    laptops.forEach(a => {
      const catId = a.categoryId ? a.categoryId.toString() : 'NO_CATEGORY';
      const catName = catMap[catId] || 'UNKNOWN_CATEGORY';
      const key = `${catName} (${catId})`;
      breakdown[key] = (breakdown[key] || 0) + 1;
    });

    console.log('Category Breakdown:', JSON.stringify(breakdown, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

check();
