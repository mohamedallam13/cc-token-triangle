const { bootstrapGasFakes } = require('./bootstrapGasFakes');

beforeAll(async () => {
  await bootstrapGasFakes();
});
