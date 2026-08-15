-- pricing_config holds the one live price list. Pin it to a single row so a
-- stray insert cannot create a second, competing set of prices that the app
-- would then pick from arbitrarily.
ALTER TABLE "pricing_config"
  ADD CONSTRAINT "pricing_config_singleton" CHECK ("id" = 1);
