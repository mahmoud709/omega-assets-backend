const mongoose = require('mongoose');

const MONGODB_URI = "mongodb://mahmoudshalaby:mahmoud1300@ac-2kufk7m-shard-00-00.zolsczi.mongodb.net:27017,ac-2kufk7m-shard-00-01.zolsczi.mongodb.net:27017,ac-2kufk7m-shard-00-02.zolsczi.mongodb.net:27017/asset_tracking?ssl=true&replicaSet=atlas-wgk4uc-shard-0&authSource=admin&retryWrites=true&w=majority";

const categorySchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  description: { type: String }
}, { timestamps: true });

const assetSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  name: String
}, { strict: false });

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
const Asset = mongoose.models.Asset || mongoose.model('Asset', assetSchema);

async function clean() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB...");

    const categories = await Category.find({});
    console.log(`Found ${categories.length} total categories.`);

    const junkNames = [
      'خامات السير ميك',
      'خامات سباكه الشريف',
      'خامات سباكه بولي خاصه بمكتب الشروق',
      'خامات سباكه جري .ام',
      'خامات سباكه فولجا',
      'خامات سباكه كومر',
      'خامات سباكه كيسيل',
      'خامات فاير',
      'خامات كهربا ار.جري .اس',
      'خامات كهربا اي.ام.نري',
      'خامات كهربا اي.ام.تري',
      'خامات كهربا شواب خاصه بمكتب الشروق',
      'خامات كهربا تري.ي',
      'خامات كهربا نري.ي',
      'خامات مبان ي',
      'ادوات مكتبية',
      'اكسسوار الوميتال',
      'اكسسوار اليرهات'
    ];

    let deletedCount = 0;
    let modifiedAssetsCount = 0;

    for (const cat of categories) {
      // If it matches exactly OR if it has 0 assets and looks like junk
      let isJunk = junkNames.includes(cat.name.trim());
      
      const assetCount = await Asset.countDocuments({ categoryId: cat._id });
      
      // Also delete any category that is completely empty (0 assets) to clean up DB
      if (assetCount === 0) {
        isJunk = true; 
      }

      if (isJunk) {
        console.log(`Deleting junk/empty category: "${cat.name}" (Assets inside: ${assetCount})`);
        
        if (assetCount > 0) {
          // Unset categoryId for these assets so they aren't orphaned pointing to nothing
          const res = await Asset.updateMany(
            { categoryId: cat._id },
            { $unset: { categoryId: 1 } }
          );
          modifiedAssetsCount += res.modifiedCount;
        }

        await Category.deleteOne({ _id: cat._id });
        deletedCount++;
      }
    }

    console.log(`\nCleanup Complete!`);
    console.log(`- Deleted Categories: ${deletedCount}`);
    console.log(`- Assets reverted to 'No Category': ${modifiedAssetsCount}`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

clean();
