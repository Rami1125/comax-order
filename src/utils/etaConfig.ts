export interface ETAConfig {
  origins: {
    [key: string]: string;
  };
  travelTimes: {
    [key: string]: number;
  };
  defaultTravelTime: number;
}

export const etaConfig: ETAConfig = {
  origins: {
    hacharash: "החרש 10, הוד השרון",
    hatalmid: "התלמיד 6, הוד השרון"
  },
  travelTimes: {
    // Origin: "החרש 10, הוד השרון" (hacharash)
    "hacharash_תל אביב": 25,
    "hacharash_פתח תקווה": 15,
    "hacharash_נתניה": 30,
    "hacharash_ירושלים": 65,
    "hacharash_חיפה": 75,
    "hacharash_באר שבע": 95,
    "hacharash_ראשון לציון": 35,
    "hacharash_אשדוד": 45,
    "hacharash_הוד השרון": 5,

    // Origin: "התלמיד 6, הוד השרון" (hatalmid)
    "hatalmid_תל אביב": 27,
    "hatalmid_פתח תקווה": 17,
    "hatalmid_נתניה": 28,
    "hatalmid_ירושלים": 67,
    "hatalmid_חיפה": 73,
    "hatalmid_באר שבע": 98,
    "hatalmid_ראשון לציון": 38,
    "hatalmid_אשדוד": 47,
    "hatalmid_הוד השרון": 4
  },
  defaultTravelTime: 45
};
