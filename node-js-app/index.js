const client = require("prom-client");
const express = require("express");
const app = express();

// Create a Registry to register the metrics
const register = new client.Registry();

// Add a default metrics and enable the collection of it
client.collectDefaultMetrics({
  app: "node-application-monitoring-app",
  prefix: "node_",
  timeout: 10000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // These are the default buckets.
  register,
});

// Create a histogram metric for the Duration of the request
const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "code"],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10], // 0.1 to 10 seconds
});

// Create a counter metric for the number of requests
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "code"],
});

// Create a counter metric for the error requests
const httpRequestsError = new client.Counter({
  name: "http_requests_error",
  help: "Total number of error HTTP requests",
  labelNames: ["method", "route", "code"],
});

// Create gauge metric for the number of requests
const httpRequestsTotalGauge = new client.Gauge({
  name: "http_requests_total_gauge",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "code"],
});

// Create a guage metric for the error requests
const httpRequestsErrorGauge = new client.Gauge({
  name: "http_requests_error_gauge",
  help: "Total number of error HTTP requests",
  labelNames: ["method", "route", "code"],
});

// Register the metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestsError);
register.registerMetric(httpRequestsTotalGauge);
register.registerMetric(httpRequestsErrorGauge);

// Handlers
const createDelayHandler = async (req, res) => {
  if (Math.floor(Math.random() * 100) === 0) {
    httpRequestsError.inc({ method: req.method, route: req.path, code: "500" });
    httpRequestsErrorGauge.inc({
      method: req.method,
      route: req.path,
      code: "500",
    });
    throw new Error("Internal Error");
  }

  // delay for 5-10 seconds
  const delaySeconds = Math.floor(Math.random() * (10 - 5)) + 3;
  await new Promise((res) => setTimeout(res, delaySeconds * 1000));

  res.end("Slow url accessed !!");
};

const createErrorHandler = async (req, res) => {
  httpRequestsError.inc({ method: req.method, route: req.path, code: "500" });
  httpRequestsErrorGauge.inc({
    method: req.method,
    route: req.path,
    code: "500",
  });
  throw new Error("Internal Error");
};

app.get("/metrics", async (req, res) => {
  // Start the timer
  const end = httpRequestDurationMicroseconds.startTimer();
  const route = req.route.path;

  res.setHeader("Content-Type", register.contentType);
  res.send(await register.metrics());

  // End timer and add labels
  end({ route, code: res.statusCode, method: req.method });
  httpRequestsTotal.inc({
    method: req.method,
    route: route,
    code: res.statusCode,
  });
  httpRequestsTotalGauge.inc({
    method: req.method,
    route: route,
    code: res.statusCode,
  });
});

app.get("/slow", async (req, res) => {
  // Start the timer
  const end = httpRequestDurationMicroseconds.startTimer();
  const route = req.route.path;

  await createDelayHandler(req, res).catch((err) => {
    res.status(500).send(err.message);
  });

  // End timer and add labels
  end({ route, code: res.statusCode, method: req.method });
  if (res.statusCode === 500) {
    httpRequestsError.inc({
      method: req.method,
      route: route,
      code: res.statusCode,
    });
    httpRequestsErrorGauge.inc({
      method: req.method,
      route: route,
      code: res.statusCode,
    });
  }
  httpRequestsTotal.inc({
    method: req.method,
    route: route,
    code: res.statusCode,
  });
  httpRequestsTotalGauge.inc({
    method: req.method,
    route: route,
    code: res.statusCode,
  });
});

app.get("/error", async (req, res) => {
  // Start the timer
  const end = httpRequestDurationMicroseconds.startTimer();
  const route = req.route.path;

  await createErrorHandler(req, res).catch((err) => {
    res.status(500).send(err.message);
  });

  // End timer and add labels
  end({ route, code: res.statusCode, method: req.method });
  httpRequestsTotal.inc({
    method: req.method,
    route: route,
    code: res.statusCode,
  });
  httpRequestsTotalGauge.inc({
    method: req.method,
    route: route,
    code: res.statusCode,
  });
});

app.get("/", (req, res) => {
  // Start the timer
  const end = httpRequestDurationMicroseconds.startTimer();
  const route = req.route.path;
  end({ route, code: res.statusCode, method: req.method });
  httpRequestsTotal.inc({ method: req.method, route: req.path, code: "200" });
  httpRequestsTotalGauge.inc({
    method: req.method,
    route: req.path,
    code: "200",
  });
  res.end("Welcome to the Observability App");
});

// Start the Express server and listen to a port
app.listen(8080, () => {
  console.log(
    "Server is running on http://localhost:8080, metrics are exposed on http://localhost:8080/metrics"
  );
});
