const mongoose = require('mongoose');
const CropProfile = require('./models/CropProfile');

// Malayalam translations for existing crops
const malayalamTranslations = {
  'sweet potato': {
    name_ml: 'ചക്കരക്കിഴങ്ങ്',
    description_ml: 'ചക്കരക്കിഴങ്ങ് ഒരു അന്നജം കൂടുതലുള്ള, പോഷകസമൃദ്ധമായ വേരുകൾ വിളയാണ്. ചൂടുള്ള കാലാവസ്ഥയിൽ വളരുന്ന ഇത് ഭക്ഷണത്തിനും മൃഗാഹാരത്തിനും ഉപയോഗിക്കുന്നു.',
    cultivationTips_ml: [
      '20-30°C താപനിലയുള്ള ചൂടുള്ള കാലാവസ്ഥ ആവശ്യമാണ്.',
      'നിലം 2-3 തവണ കുഴിച്ച് നടാനുള്ള റിഡ്ജുകൾ തയ്യാറാക്കുക.',
      'ആരോഗ്യമുള്ള വൈൻ കട്ടിംഗുകൾ (20-30 സെ.മീ. നീളം) പ്രചരണത്തിന് ഉപയോഗിക്കുക.'
    ]
  },
  'carrot': {
    name_ml: 'കാരറ്റ്',
    description_ml: 'കാരറ്റ് ഒരു വേരുകൾ പച്ചക്കറിയാണ്. ഇളകുന്ന മണൽ മണ്ണിൽ വളരുന്ന ഇത് ക്രിസ്പ്പ് ടെക്സ്ചറും മധുരമുള്ള രുചിയും ഉയർന്ന വിറ്റാമിൻ A ഉള്ളടക്കവും ഉണ്ട്.',
    cultivationTips_ml: [
      'ഉചിതമായ മണ്ണ്: ഓർഗാനിക് മാറ്റർ കൂടുതലുള്ള ഇളകുന്ന മണൽ ലോം മണ്ണ്',
      'വിത്തിടൽ: ശരിയായ ഇടവേളയിൽ വരികളിൽ നേരിട്ട് വിത്തിടുക',
      'ജലസേചനം: മണ്ണ് ഈർപ്പമുള്ളതായി നിലനിർത്താൻ ലഘുവും പതിവുമായ ജലസേചനം'
    ]
  },
  'rice': {
    name_ml: 'അരി',
    description_ml: 'അരി കൃഷി എന്നത് ജലം നിറഞ്ഞ വയലുകളിൽ അരി വളർത്തുന്ന പ്രക്രിയയാണ്. ഭൂമി തയ്യാറാക്കൽ മുതൽ വിളവെടുപ്പ് വരെ, ലോകത്തിലെ പകുതിയിലധികം ജനങ്ങളുടെ പ്രധാന ഭക്ഷണമായി സേവിക്കുന്നു.',
    cultivationTips_ml: [
      'സമൃദ്ധമായ കളിമണ്ണ് അല്ലെങ്കിൽ ലോം മണ്ണ് ആവശ്യമാണ്.',
      'ചൂടുള്ള കാലാവസ്ഥയിൽ (20-35°C) കൂടുതൽ ജലത്തോടെ മികച്ച വളർച്ച',
      'ധാന്യങ്ങൾ സ്വർണ്ണനിറമാകുമ്പോൾ വിളവെടുപ്പ് നടത്തുക'
    ]
  }
};

async function addMalayalamTranslations() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/auth_system');
    console.log('Connected to MongoDB');

    // Get all existing crop profiles
    const crops = await CropProfile.find({});
    console.log(`Found ${crops.length} crop profiles`);

    let updated = 0;
    for (const crop of crops) {
      const cropName = crop.name.toLowerCase();
      const translation = malayalamTranslations[cropName];
      
      if (translation) {
        await CropProfile.findByIdAndUpdate(crop._id, {
          name_ml: translation.name_ml,
          description_ml: translation.description_ml,
          cultivationTips_ml: translation.cultivationTips_ml
        });
        console.log(`Updated ${crop.name} with Malayalam translations`);
        updated++;
      } else {
        console.log(`No Malayalam translation found for ${crop.name}`);
      }
    }

    console.log(`Successfully updated ${updated} crop profiles with Malayalam translations`);
  } catch (error) {
    console.error('Error adding Malayalam translations:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
addMalayalamTranslations();
