import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { json, urlencoded } from "express";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { PrismaService } from "./common/prisma.service";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import { RequestLoggingInterceptor } from "./common/interceptors/request-logging.interceptor";
import { appLogger } from "./common/logger.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: appLogger,
  });
  const configService = app.get(ConfigService);
  const prismaService = app.get(PrismaService);

  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(json({ limit: "1mb" }));
  app.use(urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  app.enableCors({
    origin: configService.getOrThrow("WEB_ORIGIN"),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await prismaService.enableShutdownHooks(app);

  const port = configService.getOrThrow("PORT");
  await app.listen(port);

  appLogger.log(
    `smart-acr-api started on port ${port} [${configService.get("NODE_ENV")}]`,
    "Bootstrap",
  );
}

bootstrap().catch((err) => {
  appLogger.error(
    `Fatal error during bootstrap: ${err.message}`,
    err.stack,
    "Bootstrap",
  );
  process.exit(1);
});
