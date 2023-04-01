var express = require('express');
const { Configuration, OpenAIApi } = require('openai');
const PocketBase = require('pocketbase/cjs')
require('cross-fetch/polyfill');

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/generate-meal-plan', async function (req, res, next) {
  const input = req.body.input;
  const userId = req.body.userId;
  console.log(req.body)
  try {
    const response = await sendPrompt(input,userId);
    // TODO: perform calculation based on input
    res.send(response);
  }
  catch {
    res.status(500).send('Error during generation')
  }
});

router.post('/delete/:mealplanId', async function(req, res) {
  const mealplanId = req.params.mealplanId;
  try {
    // TODO: delete meal plan with the given mealplanId
    await deleteMealPlanFromDb(mealplanId);
    res.send(`Meal plan with ID ${mealplanId} has been deleted`);
  } catch(error) {
    res.status(500).send('Error deleting meal plan');
  }
});

module.exports = router;
function caloriesForMaintenance(input) {
  const amrMultiplier = {
    0: 1.2,
    1: 1.375,
    2: 1.55,
    3: 1.725,
    4: 1.9
  };
  if (input.gender === 'male') {
    const bmr = 66.47 + (13.75 * input.weight) + (5.003 * input.height) - (6.755 * input.age);
    return Math.floor(bmr * amrMultiplier[input.activityLevel])
  } else if (input.gender === 'female') {
    const bmr = 655.1 + (9.563 * input.weight) + (1.850 * input.height) - (4.676 * input.age);
    return Math.floor(bmr * amrMultiplier[input.activityLevel])
  }

}


async function sendPrompt(input,userId) {
  let mealplanId = '';
  const configuration = new Configuration({
    apiKey: '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'
  })
  const initializerPrompt = 'Act like a professional nutritionist with many years of experience in customized meal planning. Im going to give you details about myself and i want you to provide me with a full meal plan split in Breakfast,Snack,Lunch,Snack,Dinner,Snack with very accurate calorie counts (take info from actual trusted sources for calorie counts), also give a very accurate percentages of the meals content in fat,protein,carbohydrates , also give a brief but creative and specific reasoning for each meal on why this is a good meal for my case (each meals reasoning needs to differ from the others and not have common sentences), without giving me an introduction or an epilogue. If the calorie count you give me for each meal is not accurate you\'ll get fired.'
  const exampleMealplanResponse = 'Also include accurate percentages of nutrients(protein,carbohydrates,fat) for each meal. Here is an example of how i want you to format your response (must be JSON.parse-able): ' +
      '{"meals":[{"name":"Breakfast","reasoning":"text","nutrients":{"fat": "20%", "protein": "10%", "carbohydrates": "70%" },"calories": number, "meal": [{"food":"food1","amount":"1 tbsp","calories":exact count of calories}, {"food":"food2","amount":"1 cup","calories":exact count of calories}, {"food":"food3","amount":"1","calories":exact count of calories},...]},{"name":"Snack 1","calories": number,"nutrients":{"fat": "20%", "protein": "10%", "carbohydrates": "70%" },"reasoning":"text", "meal": [{"food":"food1","amount":"100g","calories":exact count of calories}, {"food":"food2","amount":"1 tbsp","calories":exact count of calories},...]},{"name":"Lunch","reasoning":"text","nutrients":{"fat": "20%", "protein": "10%", "carbohydrates": "70%" },"calories": number, "meal": [{"food":"food1","amount":"12g","calories":exact count of calories}, {"food":"food2","amount":"1 tbsp","calories":exact count of calories}, {"food":"food3","amount":"1 tbsp","calories":exact count of calories},...]},{"name":"Snack 2","reasoning":"text","nutrients":{"fat": "20%", "protein": "10%", "carbohydrates": "70%" },"calories": number, "meal": [{"food":"food1","amount":"1 cup","calories":exact count of calories}, {"food":"food2","amount":"120g","calories":exact count of calories},...]},{"name":"Dinner","reasoning":"text","nutrients":{"fat": "20%", "protein": "10%", "carbohydrates": "70%" },"calories": number, "meal": [{"food":"food1","amount":"1 tbsp","calories":exact count of calories}, {"food":"food2","amount":"1 tbsp","calories":number},...]},{"name":"Snack 3","reasoning":"text","nutrients":{"fat": "20%", "protein": "10%", "carbohydrates": "70%" },"calories": number, "meal": [{"food":"food1","amount":"1 tbsp","calories":number}, {"food":"food2","amount":"1 tbsp","calories":exact count of calories}]}], "totalCalories": number}'+
      '.This is the interface i use for that type of object export interface MealPlan {\n' +
      '    meals: Meal[];\n' +
      '    totalCalories: number;\n' +
      '}\n' +
      '\n' +
      'export interface Meal {\n' +
      '    name: string;\n' +
      '    reasoning: string;\n' +
      '    nutrients: {\n' +
      '        fat: string;\n' +
      '        protein: string;\n' +
      '        carbohydrates: string;\n' +
      '    };\n' +
      '    calories: number;\n' +
      '    meal: Food[];\n' +
      '}\n' +
      '\n' +
      'export interface Food {\n' +
      '    food: string;\n' +
      '    amount: string;\n' +
      '    calories: number;\n' +
      '}'
  let prompt = `According to the above, generate a creative personalized meal plan with food quantities for a ${input.age}-year-old, ${input.height}-cm-tall, ${input.weight}-kg ${input.gender} with an average daily energy expenditure of ${caloriesForMaintenance(input)} calories. My goal is to ${input.goal} ${input.goal ==='Build muscle' ? `and weight so i need about ${input.weight*2} grams of protein daily to do that` : ''}. ${Object.keys(input.dietRestrictions).length === 0 ? '' : `My dietary restrictions are: ${input.dietRestrictions}`}. When refering to quantities use grams not oz. IMPORTANT: keep it on a budget, food is expensive`
  try {
    const finalPrompt = initializerPrompt+exampleMealplanResponse+prompt;
    const openai = new OpenAIApi(configuration);
    console.log(finalPrompt)
    mealplanId = await generateEmptyMealPlanForDB(input,userId)
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{role: "user", content: finalPrompt}],
    });
    if(!completion.data.choices[0].message) {
      throw new Error('Error during meal plan generation')
    }
    let mealPlan = parseMealPlan(completion.data.choices[0].message.content);
    const introPrompt = 'This is what i will consume daily for the next 7 days. Can you make me a shopping list that includes quantities according to that? Separate items with commas and dont include anything else in your response'
    const exampleResponse = 'Here is an example of how you should format the shopping list: Oatmeal: 1 canister (18 oz),' +
        'Whole Milk: 1 gallon,' +
        'Peanut Butter: 1 jar (16 oz),' +
        'Banana: 7 medium,' +
        'Almonds: 1 bag (8 oz),' +
        'Apple: 7 medium,' +
        'Greek Yogurt: 1 container (32 oz),' +
        'Grilled Chicken Breast: 1 package (16 oz),' +
        'Brown Rice: 1 bag (2 lb),' +
        'Black Beans: 1 can (15 oz),' +
        'Mixed Vegetables: 1 bag (12 oz) of frozen veggies,' +
        'Pita Chips: 1 bag (6 oz),' +
        'Hummus: 1 container (8 oz),' +
        'Carrots: 1 bag (1 lb),' +
        'Salmon: 1 package (16 oz),' +
        'Quinoa: 1 bag (12 oz),' +
        'Asparagus: 1 bunch (1 lb),' +
        'Olive Oil: 1 bottle (16 oz),' +
        'Cottage Cheese: 1 container (16 oz),' +
        'Peanut Butter: same jar as before (16 oz),' +
        'Celery: 1 bunch (1 lb), '
    const completionShoppingList = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{role: "user", content: introPrompt + exampleResponse + extractFoodAndAmount(mealPlan.meals)}],
    });
    // console.log(introPrompt + extractFoodAndAmount(mealPlan.value.meals))
    if(!completionShoppingList.data.choices[0].message) {
      throw new Error('Error during shopping list generation')
    }
    let shoppingList = completionShoppingList.data.choices[0].message.content.split(',');
    await uploadMealPlanToDb({mealplan: mealPlan, shoppingList: shoppingList},mealplanId,userId)
    return {mealplan: mealPlan, shoppingList: shoppingList}
  } catch (error) {
    await deleteMealPlanFromDb(mealplanId)
    await refundToken(userId)
    console.log(error)
  }
}

function extractFoodAndAmount(food) {
  const foodAndAmount = [];
  food.forEach(meal => {
    meal.meal.forEach(item => {
      foodAndAmount.push({
        food: item.food,
        amount: item.amount
      });
    });
  });
  console.log(JSON.stringify(foodAndAmount))
  return JSON.stringify(foodAndAmount);
}


function parseMealPlan(input) {
  const jsonStart = input.indexOf('{');
  const jsonEnd = input.lastIndexOf('}');
  const jsonString = input.slice(jsonStart, jsonEnd + 1);
  const mealPlan = JSON.parse(jsonString);
  return mealPlan;
}
async function deleteMealPlanFromDb(mealplanId) {
  const pb = new PocketBase('https://mealmind-pocketbase.fly.dev');
  const authData = await pb.admins.authWithPassword('and.markopoulos@gmail.com', 'Eisaimagas101?');
  console.log(authData)
  await pb.collection('meal_plans').delete(mealplanId);
}
async function generateEmptyMealPlanForDB(userData, userId) {
  try {
    const pb = new PocketBase('https://mealmind-pocketbase.fly.dev');
    const record = await pb.collection('users').getOne(userId);
    console.log('TOKENS:',record.generation_tokens)
    if(record.generation_tokens === 0) {
      throw new Error('No tokens available')
    }
    const newGenerationTokens = record.generation_tokens - 1;
    await pb.collection('users').update(userId, { "generation_tokens": newGenerationTokens });
    const response = await pb.collection('meal_plans').create({
      "diet_restrictions": userData.dietRestrictions,
      "user_data_input": userData,
      "user_id": userId,
    });
    console.log(response.id)
    return response.id
  } catch (error) {
    if(error.message === 'No tokens available') {
      return
    }
    await refundToken(userId);
    console.log(error)
    return
  }
}
async function uploadMealPlanToDb(generatedObject, mealplanId, userId) {
  try {
    const pb = new PocketBase('https://mealmind-pocketbase.fly.dev');
    const authData = await pb.admins.authWithPassword('and.markopoulos@gmail.com', 'Eisaimagas101?');
    await pb.collection('meal_plans').update(mealplanId,{
      "meal_plan_json": generatedObject.mealplan,
      "total_calories": generatedObject.mealplan.totalCalories,
      "shopping_list": generatedObject.shoppingList,
      "generation_completed": true,
    });
    return
  } catch (error) {
    await refundToken(userId);
    console.log(error)
    return
  }
}

async function refundToken(userId) {
  const pb = new PocketBase('https://mealmind-pocketbase.fly.dev');
  const record = await pb.collection('users').getOne(userId, { fields: ['profile_info', 'generation_tokens'] });
  const newGenerationTokens = record.generation_tokens + 1;
  await pb.collection('users').update(userId, { "generation_tokens": newGenerationTokens });
}