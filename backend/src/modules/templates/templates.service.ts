import { Injectable } from "@nestjs/common";
import { ensureTemplateCatalog, templateFamilySortValue } from "../../common/template-catalog";
import { PrismaService } from "../../common/prisma.service";

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    await ensureTemplateCatalog(this.prisma);

    const templates = await this.prisma.templateVersion.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: "asc" }],
    });
    const sortedTemplates = [...templates].sort((left, right) => {
      const familyOrder = templateFamilySortValue(left.family) - templateFamilySortValue(right.family);
      if (familyOrder !== 0) {
        return familyOrder;
      }

      return right.version.localeCompare(left.version);
    });

    return {
      items: sortedTemplates.map((template) => ({
        id: template.id,
        family: template.family,
        code: template.code,
        version: template.version,
        title: template.title,
        languageMode: template.languageMode,
        requiresCountersigning: template.requiresCountersigning,
        pageCount: template.pageCount,
      })),
      total: sortedTemplates.length,
    };
  }
}
