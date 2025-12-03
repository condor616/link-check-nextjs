try {
  const invalidData = {};
  console.log("Attempting to create Set from object...");
  new Set(invalidData);
} catch (e) {
  console.log("Caught expected error:");
  console.log(e.message);
}

try {
  const validData = [];
  console.log("\nAttempting to create Set from array...");
  new Set(validData);
  console.log("Success!");
} catch (e) {
  console.log("Caught unexpected error:");
  console.log(e.message);
}
