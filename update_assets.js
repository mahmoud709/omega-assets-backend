const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Asset = mongoose.model('Asset', new mongoose.Schema({ name: String }, { strict: false }));
    
    const assets = await Asset.find({ name: { $regex: /توتال/i } });
    console.log('Found matching assets:', assets.length);

    for (const a of assets) {
      const oldName = a.name || '';
      if (!oldName.includes('جهاز محطة متكاملة')) {
        const newName = oldName.replace(/توتال/g, 'جهاز محطة متكاملة (Total Station)');
        await Asset.updateOne({ _id: a._id }, { $set: { name: newName } });
        console.log('Updated:', oldName, '->', newName);
      }
    }

    console.log('Update completed successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
