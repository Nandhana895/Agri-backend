const mongoose = require('mongoose');
const FertilizerStandard = require('./models/FertilizerStandard');

// Comprehensive fertilizer standards data for Indian agriculture
const fertilizerStandards = [
  // Rice - Kerala
  {
    crop: 'Rice',
    region: 'Kerala',
    season: 'Kharif',
    nitrogenPerHa: 120,
    phosphorusPerHa: 60,
    potassiumPerHa: 60,
    soilAdjustments: {
      sandy: { nitrogen: 1.2, phosphorus: 1.3, potassium: 1.1 },
      clay: { nitrogen: 0.9, phosphorus: 0.8, potassium: 0.9 },
      loamy: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      silty: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      peaty: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.8 },
      chalky: { nitrogen: 1.1, phosphorus: 0.9, potassium: 1.0 }
    },
    organicMatterAdjustments: {
      low: { nitrogen: 1.3, phosphorus: 1.2, potassium: 1.1 },
      medium: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      high: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.9 }
    },
    splitDoses: [
      { stage: 'Basal', nitrogenPercent: 50, phosphorusPercent: 100, potassiumPercent: 0, timing: 'At transplanting', notes: 'Apply DAP and half urea' },
      { stage: 'Tillering', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 0, timing: '25-30 days after transplanting', notes: 'Apply remaining urea' },
      { stage: 'Panicle Initiation', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 100, timing: '45-50 days after transplanting', notes: 'Apply MOP and remaining urea' }
    ],
    tips: [
      'Split nitrogen into 3 equal applications for better efficiency',
      'Apply phosphorus at transplanting for root development',
      'Potassium application at panicle initiation improves grain quality',
      'Use neem-coated urea to reduce nitrogen losses',
      'Maintain 2-3 cm water depth during application'
    ],
    organicAdvice: {
      compost: { amount: '5-10 tonnes/ha', timing: '2-3 weeks before transplanting' },
      manure: { amount: '10-15 tonnes/ha', timing: '3-4 weeks before transplanting' },
      greenManure: { crops: ['Sesbania', 'Dhaincha'], timing: 'Incorporate 2-3 weeks before transplanting' },
      biofertilizers: ['Azospirillum', 'Phosphobacteria', 'Potash mobilizing bacteria']
    }
  },
  
  // Rice - Punjab
  {
    crop: 'Rice',
    region: 'Punjab',
    season: 'Kharif',
    nitrogenPerHa: 150,
    phosphorusPerHa: 75,
    potassiumPerHa: 75,
    soilAdjustments: {
      sandy: { nitrogen: 1.2, phosphorus: 1.3, potassium: 1.1 },
      clay: { nitrogen: 0.9, phosphorus: 0.8, potassium: 0.9 },
      loamy: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      silty: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      peaty: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.8 },
      chalky: { nitrogen: 1.1, phosphorus: 0.9, potassium: 1.0 }
    },
    organicMatterAdjustments: {
      low: { nitrogen: 1.3, phosphorus: 1.2, potassium: 1.1 },
      medium: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      high: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.9 }
    },
    splitDoses: [
      { stage: 'Basal', nitrogenPercent: 50, phosphorusPercent: 100, potassiumPercent: 0, timing: 'At transplanting', notes: 'Apply DAP and half urea' },
      { stage: 'Tillering', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 0, timing: '25-30 days after transplanting', notes: 'Apply remaining urea' },
      { stage: 'Panicle Initiation', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 100, timing: '45-50 days after transplanting', notes: 'Apply MOP and remaining urea' }
    ],
    tips: [
      'Higher nitrogen requirement due to intensive cultivation',
      'Use zinc sulfate 25 kg/ha for zinc deficiency',
      'Apply gypsum 500 kg/ha for sodic soils',
      'Maintain proper water management for nutrient efficiency'
    ],
    organicAdvice: {
      compost: { amount: '8-12 tonnes/ha', timing: '2-3 weeks before transplanting' },
      manure: { amount: '12-18 tonnes/ha', timing: '3-4 weeks before transplanting' },
      greenManure: { crops: ['Sesbania', 'Sunhemp'], timing: 'Incorporate 2-3 weeks before transplanting' },
      biofertilizers: ['Azospirillum', 'Phosphobacteria', 'Potash mobilizing bacteria']
    }
  },

  // Wheat - Punjab
  {
    crop: 'Wheat',
    region: 'Punjab',
    season: 'Rabi',
    nitrogenPerHa: 120,
    phosphorusPerHa: 60,
    potassiumPerHa: 40,
    soilAdjustments: {
      sandy: { nitrogen: 1.2, phosphorus: 1.3, potassium: 1.1 },
      clay: { nitrogen: 0.9, phosphorus: 0.8, potassium: 0.9 },
      loamy: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      silty: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      peaty: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.8 },
      chalky: { nitrogen: 1.1, phosphorus: 0.9, potassium: 1.0 }
    },
    organicMatterAdjustments: {
      low: { nitrogen: 1.3, phosphorus: 1.2, potassium: 1.1 },
      medium: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      high: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.9 }
    },
    splitDoses: [
      { stage: 'Basal', nitrogenPercent: 50, phosphorusPercent: 100, potassiumPercent: 100, timing: 'At sowing', notes: 'Apply DAP, MOP and half urea' },
      { stage: 'First Irrigation', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 0, timing: '20-25 days after sowing', notes: 'Apply remaining urea' },
      { stage: 'Second Irrigation', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 0, timing: '40-45 days after sowing', notes: 'Apply remaining urea' }
    ],
    tips: [
      'Apply phosphorus at sowing for root development',
      'Split nitrogen into 3 applications for better efficiency',
      'Use zinc sulfate 25 kg/ha for zinc deficiency',
      'Apply gypsum 500 kg/ha for sodic soils',
      'Maintain proper irrigation scheduling'
    ],
    organicAdvice: {
      compost: { amount: '5-8 tonnes/ha', timing: '2-3 weeks before sowing' },
      manure: { amount: '8-12 tonnes/ha', timing: '3-4 weeks before sowing' },
      greenManure: { crops: ['Sesbania', 'Sunhemp'], timing: 'Incorporate 2-3 weeks before sowing' },
      biofertilizers: ['Azotobacter', 'Phosphobacteria', 'Potash mobilizing bacteria']
    }
  },

  // Maize - Karnataka
  {
    crop: 'Maize',
    region: 'Karnataka',
    season: 'Kharif',
    nitrogenPerHa: 150,
    phosphorusPerHa: 75,
    potassiumPerHa: 75,
    soilAdjustments: {
      sandy: { nitrogen: 1.2, phosphorus: 1.3, potassium: 1.1 },
      clay: { nitrogen: 0.9, phosphorus: 0.8, potassium: 0.9 },
      loamy: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      silty: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      peaty: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.8 },
      chalky: { nitrogen: 1.1, phosphorus: 0.9, potassium: 1.0 }
    },
    organicMatterAdjustments: {
      low: { nitrogen: 1.3, phosphorus: 1.2, potassium: 1.1 },
      medium: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      high: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.9 }
    },
    splitDoses: [
      { stage: 'Basal', nitrogenPercent: 50, phosphorusPercent: 100, potassiumPercent: 50, timing: 'At sowing', notes: 'Apply DAP, half MOP and half urea' },
      { stage: 'Knee High', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 0, timing: '25-30 days after sowing', notes: 'Apply remaining urea' },
      { stage: 'Tasseling', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 50, timing: '45-50 days after sowing', notes: 'Apply remaining urea and MOP' }
    ],
    tips: [
      'Apply phosphorus at sowing for root development',
      'Split nitrogen into 3 applications for better efficiency',
      'Use zinc sulfate 25 kg/ha for zinc deficiency',
      'Apply boron 2 kg/ha for boron deficiency',
      'Maintain proper plant population'
    ],
    organicAdvice: {
      compost: { amount: '8-12 tonnes/ha', timing: '2-3 weeks before sowing' },
      manure: { amount: '12-18 tonnes/ha', timing: '3-4 weeks before sowing' },
      greenManure: { crops: ['Sesbania', 'Sunhemp'], timing: 'Incorporate 2-3 weeks before sowing' },
      biofertilizers: ['Azospirillum', 'Phosphobacteria', 'Potash mobilizing bacteria']
    }
  },

  // Sugarcane - Maharashtra
  {
    crop: 'Sugarcane',
    region: 'Maharashtra',
    season: 'All',
    nitrogenPerHa: 300,
    phosphorusPerHa: 150,
    potassiumPerHa: 150,
    soilAdjustments: {
      sandy: { nitrogen: 1.2, phosphorus: 1.3, potassium: 1.1 },
      clay: { nitrogen: 0.9, phosphorus: 0.8, potassium: 0.9 },
      loamy: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      silty: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      peaty: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.8 },
      chalky: { nitrogen: 1.1, phosphorus: 0.9, potassium: 1.0 }
    },
    organicMatterAdjustments: {
      low: { nitrogen: 1.3, phosphorus: 1.2, potassium: 1.1 },
      medium: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      high: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.9 }
    },
    splitDoses: [
      { stage: 'Basal', nitrogenPercent: 30, phosphorusPercent: 100, potassiumPercent: 30, timing: 'At planting', notes: 'Apply DAP, MOP and urea' },
      { stage: 'Tillering', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 0, timing: '60-75 days after planting', notes: 'Apply urea' },
      { stage: 'Grand Growth', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 35, timing: '120-135 days after planting', notes: 'Apply urea and MOP' },
      { stage: 'Maturity', nitrogenPercent: 20, phosphorusPercent: 0, potassiumPercent: 35, timing: '180-195 days after planting', notes: 'Apply urea and MOP' }
    ],
    tips: [
      'Apply phosphorus at planting for root development',
      'Split nitrogen into 4 applications for better efficiency',
      'Use zinc sulfate 25 kg/ha for zinc deficiency',
      'Apply gypsum 500 kg/ha for sodic soils',
      'Maintain proper irrigation scheduling'
    ],
    organicAdvice: {
      compost: { amount: '15-20 tonnes/ha', timing: '2-3 weeks before planting' },
      manure: { amount: '20-25 tonnes/ha', timing: '3-4 weeks before planting' },
      greenManure: { crops: ['Sesbania', 'Sunhemp'], timing: 'Incorporate 2-3 weeks before planting' },
      biofertilizers: ['Azospirillum', 'Phosphobacteria', 'Potash mobilizing bacteria']
    }
  },

  // Cotton - Gujarat
  {
    crop: 'Cotton',
    region: 'Gujarat',
    season: 'Kharif',
    nitrogenPerHa: 120,
    phosphorusPerHa: 60,
    potassiumPerHa: 60,
    soilAdjustments: {
      sandy: { nitrogen: 1.2, phosphorus: 1.3, potassium: 1.1 },
      clay: { nitrogen: 0.9, phosphorus: 0.8, potassium: 0.9 },
      loamy: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      silty: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      peaty: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.8 },
      chalky: { nitrogen: 1.1, phosphorus: 0.9, potassium: 1.0 }
    },
    organicMatterAdjustments: {
      low: { nitrogen: 1.3, phosphorus: 1.2, potassium: 1.1 },
      medium: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      high: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.9 }
    },
    splitDoses: [
      { stage: 'Basal', nitrogenPercent: 50, phosphorusPercent: 100, potassiumPercent: 50, timing: 'At sowing', notes: 'Apply DAP, half MOP and half urea' },
      { stage: 'Square Formation', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 0, timing: '45-50 days after sowing', notes: 'Apply urea' },
      { stage: 'Flowering', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 50, timing: '75-80 days after sowing', notes: 'Apply urea and MOP' }
    ],
    tips: [
      'Apply phosphorus at sowing for root development',
      'Split nitrogen into 3 applications for better efficiency',
      'Use zinc sulfate 25 kg/ha for zinc deficiency',
      'Apply boron 2 kg/ha for boron deficiency',
      'Maintain proper plant population'
    ],
    organicAdvice: {
      compost: { amount: '8-12 tonnes/ha', timing: '2-3 weeks before sowing' },
      manure: { amount: '12-18 tonnes/ha', timing: '3-4 weeks before sowing' },
      greenManure: { crops: ['Sesbania', 'Sunhemp'], timing: 'Incorporate 2-3 weeks before sowing' },
      biofertilizers: ['Azospirillum', 'Phosphobacteria', 'Potash mobilizing bacteria']
    }
  },

  // Potato - West Bengal
  {
    crop: 'Potato',
    region: 'West Bengal',
    season: 'Rabi',
    nitrogenPerHa: 150,
    phosphorusPerHa: 75,
    potassiumPerHa: 150,
    soilAdjustments: {
      sandy: { nitrogen: 1.2, phosphorus: 1.3, potassium: 1.1 },
      clay: { nitrogen: 0.9, phosphorus: 0.8, potassium: 0.9 },
      loamy: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      silty: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      peaty: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.8 },
      chalky: { nitrogen: 1.1, phosphorus: 0.9, potassium: 1.0 }
    },
    organicMatterAdjustments: {
      low: { nitrogen: 1.3, phosphorus: 1.2, potassium: 1.1 },
      medium: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      high: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.9 }
    },
    splitDoses: [
      { stage: 'Basal', nitrogenPercent: 50, phosphorusPercent: 100, potassiumPercent: 50, timing: 'At planting', notes: 'Apply DAP, half MOP and half urea' },
      { stage: 'Earthing Up', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 0, timing: '30-35 days after planting', notes: 'Apply urea' },
      { stage: 'Tuber Formation', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 50, timing: '50-55 days after planting', notes: 'Apply urea and MOP' }
    ],
    tips: [
      'Apply phosphorus at planting for root development',
      'Split nitrogen into 3 applications for better efficiency',
      'Use zinc sulfate 25 kg/ha for zinc deficiency',
      'Apply boron 2 kg/ha for boron deficiency',
      'Maintain proper plant population'
    ],
    organicAdvice: {
      compost: { amount: '8-12 tonnes/ha', timing: '2-3 weeks before planting' },
      manure: { amount: '12-18 tonnes/ha', timing: '3-4 weeks before planting' },
      greenManure: { crops: ['Sesbania', 'Sunhemp'], timing: 'Incorporate 2-3 weeks before planting' },
      biofertilizers: ['Azospirillum', 'Phosphobacteria', 'Potash mobilizing bacteria']
    }
  },

  // Tomato - Andhra Pradesh
  {
    crop: 'Tomato',
    region: 'Andhra Pradesh',
    season: 'All',
    nitrogenPerHa: 120,
    phosphorusPerHa: 60,
    potassiumPerHa: 120,
    soilAdjustments: {
      sandy: { nitrogen: 1.2, phosphorus: 1.3, potassium: 1.1 },
      clay: { nitrogen: 0.9, phosphorus: 0.8, potassium: 0.9 },
      loamy: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      silty: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      peaty: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.8 },
      chalky: { nitrogen: 1.1, phosphorus: 0.9, potassium: 1.0 }
    },
    organicMatterAdjustments: {
      low: { nitrogen: 1.3, phosphorus: 1.2, potassium: 1.1 },
      medium: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      high: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.9 }
    },
    splitDoses: [
      { stage: 'Basal', nitrogenPercent: 50, phosphorusPercent: 100, potassiumPercent: 50, timing: 'At transplanting', notes: 'Apply DAP, half MOP and half urea' },
      { stage: 'Flowering', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 0, timing: '30-35 days after transplanting', notes: 'Apply urea' },
      { stage: 'Fruit Setting', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 50, timing: '50-55 days after transplanting', notes: 'Apply urea and MOP' }
    ],
    tips: [
      'Apply phosphorus at transplanting for root development',
      'Split nitrogen into 3 applications for better efficiency',
      'Use zinc sulfate 25 kg/ha for zinc deficiency',
      'Apply boron 2 kg/ha for boron deficiency',
      'Maintain proper plant population'
    ],
    organicAdvice: {
      compost: { amount: '8-12 tonnes/ha', timing: '2-3 weeks before transplanting' },
      manure: { amount: '12-18 tonnes/ha', timing: '3-4 weeks before transplanting' },
      greenManure: { crops: ['Sesbania', 'Sunhemp'], timing: 'Incorporate 2-3 weeks before transplanting' },
      biofertilizers: ['Azospirillum', 'Phosphobacteria', 'Potash mobilizing bacteria']
    }
  },

  // Onion - Maharashtra
  {
    crop: 'Onion',
    region: 'Maharashtra',
    season: 'Rabi',
    nitrogenPerHa: 100,
    phosphorusPerHa: 50,
    potassiumPerHa: 100,
    soilAdjustments: {
      sandy: { nitrogen: 1.2, phosphorus: 1.3, potassium: 1.1 },
      clay: { nitrogen: 0.9, phosphorus: 0.8, potassium: 0.9 },
      loamy: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      silty: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      peaty: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.8 },
      chalky: { nitrogen: 1.1, phosphorus: 0.9, potassium: 1.0 }
    },
    organicMatterAdjustments: {
      low: { nitrogen: 1.3, phosphorus: 1.2, potassium: 1.1 },
      medium: { nitrogen: 1.0, phosphorus: 1.0, potassium: 1.0 },
      high: { nitrogen: 0.8, phosphorus: 0.9, potassium: 0.9 }
    },
    splitDoses: [
      { stage: 'Basal', nitrogenPercent: 50, phosphorusPercent: 100, potassiumPercent: 50, timing: 'At transplanting', notes: 'Apply DAP, half MOP and half urea' },
      { stage: 'Bulb Formation', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 0, timing: '30-35 days after transplanting', notes: 'Apply urea' },
      { stage: 'Bulb Development', nitrogenPercent: 25, phosphorusPercent: 0, potassiumPercent: 50, timing: '50-55 days after transplanting', notes: 'Apply urea and MOP' }
    ],
    tips: [
      'Apply phosphorus at transplanting for root development',
      'Split nitrogen into 3 applications for better efficiency',
      'Use zinc sulfate 25 kg/ha for zinc deficiency',
      'Apply boron 2 kg/ha for boron deficiency',
      'Maintain proper plant population'
    ],
    organicAdvice: {
      compost: { amount: '8-12 tonnes/ha', timing: '2-3 weeks before transplanting' },
      manure: { amount: '12-18 tonnes/ha', timing: '3-4 weeks before transplanting' },
      greenManure: { crops: ['Sesbania', 'Sunhemp'], timing: 'Incorporate 2-3 weeks before transplanting' },
      biofertilizers: ['Azospirillum', 'Phosphobacteria', 'Potash mobilizing bacteria']
    }
  }
];

async function seedFertilizerStandards() {
  try {
    // Clear existing data
    await FertilizerStandard.deleteMany({});
    
    // Insert new data
    await FertilizerStandard.insertMany(fertilizerStandards);
    
    console.log('✅ Fertilizer standards seeded successfully');
    console.log(`📊 Inserted ${fertilizerStandards.length} fertilizer standards`);
    
    // Show summary by region
    const regions = [...new Set(fertilizerStandards.map(f => f.region))];
    console.log(`🌍 Regions covered: ${regions.join(', ')}`);
    
    // Show summary by crop
    const crops = [...new Set(fertilizerStandards.map(f => f.crop))];
    console.log(`🌾 Crops covered: ${crops.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error seeding fertilizer standards:', error);
  }
}

module.exports = { seedFertilizerStandards, fertilizerStandards };
