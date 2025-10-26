module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
  transformIgnorePatterns: [
    "node_modules/(?!(expo|@expo|@react-native|react-native|expo-router|@react-navigation)/)",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
};
