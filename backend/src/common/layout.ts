import { PrismaService } from './prisma.service';

export const BUILTIN_LAYOUT_KEYS = ['about', 'vision', 'works', 'links', 'contact', 'reviews'];
const layoutKey = /^(about|vision|works|links|contact|reviews|sec-\d+)$/;

export type LayoutItem = {
  key: string; labelAr: string; labelEn: string; visible: boolean;
  kind: 'builtin' | 'section'; sectionId?: number;
};

export async function resolveLayout(prisma: PrismaService): Promise<LayoutItem[]> {
  const [setting, sections] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: 'layout' } }),
    prisma.section.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] }),
  ]);
  const saved = Array.isArray(setting?.value) ? setting.value as any[] : [];
  const sectionByKey = new Map(sections.map((s) => [`sec-${s.id}`, s]));
  const valid = (x: any) => x && typeof x.key === 'string' && layoutKey.test(x.key)
    && (BUILTIN_LAYOUT_KEYS.includes(x.key) || sectionByKey.has(x.key));
  const ordered = saved.filter(valid);
  const seen = new Set<string>();
  const result: LayoutItem[] = [];
  for (const raw of ordered) {
    if (seen.has(raw.key)) continue;
    seen.add(raw.key);
    const section = sectionByKey.get(raw.key);
    result.push({ key: raw.key, labelAr: section ? section.titleAr : typeof raw.labelAr === 'string' ? raw.labelAr : '', labelEn: section ? section.titleEn : typeof raw.labelEn === 'string' ? raw.labelEn : '', visible: typeof raw.visible === 'boolean' ? raw.visible : true, kind: section ? 'section' : 'builtin', ...(section ? { sectionId: section.id } : {}) });
  }
  for (const key of [...BUILTIN_LAYOUT_KEYS, ...sections.map((s) => `sec-${s.id}`)]) {
    if (seen.has(key)) continue;
    const section = sectionByKey.get(key);
    result.push({ key, labelAr: section?.titleAr || '', labelEn: section?.titleEn || '', visible: true, kind: section ? 'section' : 'builtin', ...(section ? { sectionId: section.id } : {}) });
  }
  return result;
}
