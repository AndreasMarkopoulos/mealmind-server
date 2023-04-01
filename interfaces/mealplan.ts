export interface UserAuthData {
    avatar: string,
    created: string,
    email: string,
    emailVisibility: string,
    id: string,
    updated: string,
    username: string,
    verified: boolean,
    isNew: boolean,
}

export interface MealPlan {
    meals: Meal[];
    totalCalories: number;
}

export interface Meal {
    name: string;
    reasoning: string;
    nutrients: Nutrients;
    calories: number;
    meal: Food[];
}

interface Nutrients {
    fat: string;
    protein: string;
    carbohydrates: string;
}

export interface GptCompletion {
    choices: CompletionChoice[];
    created: number;
    id: string;
    model: string;
    object: string,
    usage: object
}

interface CompletionChoice {
    finish_reason: string;
    index: number;
    message: {
        content: string;
        role: string;
    };
}

export interface Food {
    food: string;
    amount: string;
    calories: number;
}

export interface UserDietInput {
    weight: number;
    age: number;
    height: number;
    gender: string;
    goal: string;
    activityLevel: number;
    dietRestrictions: EnumObject
}

type EnumObject = {
    [key: number]: string;
}
