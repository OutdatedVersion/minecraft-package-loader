import mineflayer from 'mineflayer';
import { TagType, type List } from 'prismarine-nbt';
// @ts-expect-error
import vec3 from 'vec3';
import { setTimeout } from 'timers/promises';
import { Tags } from 'prismarine-nbt';
import debug from 'debug';
import { z } from 'zod';

const envSchema = z.object({
  MINECRAFT_HOST: z.string(),
  MINECRAFT_PORT: z.string().transform((x) => parseInt(x, 10)),
  MINECRAFT_USERNAME: z.string(),
  MINECRAFT_CHEST_X: z.string().transform((x) => parseInt(x, 10)),
  MINECRAFT_CHEST_Y: z.string().transform((x) => parseInt(x, 10)),
  MINECRAFT_CHEST_Z: z.string().transform((x) => parseInt(x, 10)),
});
const env = envSchema.parse(process.env);

const log = debug('loader:minecraft');

const bot = mineflayer.createBot({
  host: env.MINECRAFT_HOST,
  port: env.MINECRAFT_PORT,
  username: env.MINECRAFT_USERNAME,
  auth: 'offline',
});

type Package = {
  name: string;
  version: string;
  author: string;
  source: string;
  // time when we picked it up. not when the book was created.
  addedAt: number;
};

type WrittenBook = {
  pages: List<TagType.String>;
  filtered_title: Tags['string'];
  author: Tags['string'];
  title: Tags['string'];
};

let loaded = false;
const packages = new Map<string, Package>();

export const getPackage = async (name: string) => {
  let ready;
  while (!(ready = loaded)) {
    debug(`Trying to load package but we haven't loaded. Trying again soon...`);
    await setTimeout(5);
  }

  return packages.get(name);
};

bot.on('spawn', async () => {
  const loc = vec3(
    env.MINECRAFT_CHEST_X,
    env.MINECRAFT_CHEST_Y,
    env.MINECRAFT_CHEST_Z
  );
  let block = bot.blockAt(loc);
  while (!block) {
    log('Block state not yet available. Trying again soon..', loc);
    await setTimeout(10);
    block = bot.blockAt(loc);
  }
  log('Block state available', loc);

  const chest = await bot.openContainer(block);

  for (const slot of chest.slots) {
    if (slot?.type !== 1047 || slot.nbt?.type !== TagType.Compound) {
      continue;
    }
    const book = slot.nbt.value as unknown as WrittenBook;

    const existing = packages.get(book.title.value);
    if (!existing) {
      const pages = book.pages.value.value;
      const firstPage = JSON.parse(pages[0]).text as string;
      const idx = firstPage.indexOf('\n');
      const version = firstPage.substring(0, idx).trim();
      const source = firstPage.substring(idx).trim();

      const pkg = {
        name: book.title.value,
        author: book.author.value,
        version,
        source,
        addedAt: Date.now(),
      };
      packages.set(pkg.name, pkg);
      log('New package', pkg);
    }
  }
  loaded = true;

  chest.close();
  log('Shutting down bot');
  bot.end();
  log('Shut down');
});
