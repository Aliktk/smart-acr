import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const templates = await this.prisma.templateVersion.findMany({
      where: { isActive: true },
      orderBy: [{ family: "asc" }, { version: "desc" }],
    });

    return {
      items: templates.map((template) => ({
        id: template.id,
        family: template.family,
        code: template.code,
        version: template.version,
        title: template.title,
        languageMode: template.languageMode,
        requiresCountersigning: template.requiresCountersigning,
        pageCount: template.pageCount,
      })),
      total: templates.length,
    };
  }
}
