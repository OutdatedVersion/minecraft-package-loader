/// Using exclusively packets to open up the chest
// This is what minecraft.mts does but with a lower-level API

import { createClient, states, PacketMeta } from 'minecraft-protocol';
import { setTimeout } from 'timers/promises';

// OUT net.minecraft.network.protocol.game.PacketPlayInUseItem
// OUT net.minecraft.network.protocol.game.PacketPlayInArmAnimation
// IN net.minecraft.network.protocol.game.PacketPlayOutOpenWindow
// IN net.minecraft.network.protocol.game.PacketPlayOutWindowItems
// IN net.minecraft.network.protocol.game.PacketPlayOutSetSlot
// IN net.minecraft.network.protocol.game.PacketPlayOutBlockChange
// IN net.minecraft.network.protocol.game.PacketPlayOutBlockChange
// IN net.minecraft.network.protocol.game.PacketPlayOutEntityVelocity
// IN net.minecraft.network.protocol.game.PacketPlayOutEntity$PacketPlayOutRelEntityMove
// IN net.minecraft.network.protocol.game.PacketPlayOutBlockAction
// IN net.minecraft.network.protocol.game.ClientboundBlockChangedAckPacket

const client = createClient({
  username: 'other3',
  auth: 'offline',
  host: '127.0.0.1',
  port: 25565,
});

type PositionPacket = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  flags: number;
  teleportId: number;
};

// https://wiki.vg/Protocol#Synchronize_Player_Position
function confirmPlayerPositionSync(packet: unknown, meta: PacketMeta) {
  const position = packet as PositionPacket;
  console.log(
    `Position update to${position.x.toFixed(2)}, ${position.y.toFixed(
      2
    )}, ${position.z.toFixed(2)}`
  );
  client.write('teleport_confirm', { teleportId: position.teleportId });
  console.log(`Confirmed position (teleport ID ${position.teleportId})`);
}
client.on('position', confirmPlayerPositionSync);

let sent = false;
client.on('state', async (newState, oldState) => {
  if (newState === states.PLAY) {
    console.log('PLAY');

    process.on('SIGINT', () => {
      client.end();
      console.log('ended client');
    });

    await setTimeout(2000);
    // protocol.json configures [x] tool to map
    // packet IDs and packet_<name> to relevant packets

    // client.write('held_item_slot', { slotId: 3 });
    // {"name":"","state":"play","data":},

    client.write('position_look', {
      x: -30.42816320365273,
      y: 71,
      z: -13.551890654478848,
      yaw: 0.03381943702697754,
      pitch: 41.249935150146484,
      onGround: false,
    });
    // client->server: play look :

    client.write('block_place', {
      hand: 0,
      location: { x: -31, z: -13, y: 71 },
      direction: 1, // 1 = top face
      cursorX: 0.5403679609298706,
      cursorY: 0.875,
      cursorZ: 0.1885908544063568,
      insideBlock: false,
      sequence: 1,
    });
    client.write('arm_animation', { hand: 0 });
    sent = true;
    console.log('------- did it');
  }
});

let windowId: number | undefined;
client.on('packet', (packet, meta) => {
  if (sent) {
    switch (meta.name) {
      case 'open_window':
        windowId = packet.windowId;
        console.log(`Opened chest (${windowId})`);
        break;
      case 'window_items':
        const items = packet as WindowItemsPacket;
        if (windowId && windowId === items.windowId) {
          console.log(`Closing chest (${windowId})`);
          client.write('close_window', { windowId });

          for (const item of items.items) {
            if (item.present && 'nbtData' in item) {
              const { title, author, pages } = item.nbtData.value;
              const firstPage = JSON.parse(pages.value.value[0]).text as string;
              const idx = firstPage.indexOf('\n');
              const version = firstPage.substring(0, idx).trim();
              const rest = firstPage.substring(idx).trim();

              console.log('New registry package', {
                name: title.value,
                author: author.value,
                version,
                source: rest,
              });
            }
          }
        }
        break;
    }
  }
});

const Item = {
  WrittenBook: 1047,
} as const;
type Item = typeof Item;

type NbtString<Value extends string = string> = {
  type: 'string';
  value: Value;
};

type NbtCompound<Value> = {
  type: 'compound';
  name: '';
  value: Value;
};

// TODO
type NbtStringList = {
  type: 'list';
  value: {
    type: 'string';
    value: string[];
  };
};

type WindowItemsPacket = {
  windowId: number;
  stateId: number;
  // TODO
  carriedItem: { present: false };
  items: Array<
    | {
        present: false;
      }
    | {
        present: true;
        itemId: Item['WrittenBook'];
        itemCount: number;
        nbtData: NbtCompound<{
          pages: NbtStringList;
          filtered_title: NbtString;
          title: NbtString;
          author: NbtString;
        }>;
      }
    | {
        present: true;
        itemId: number;
        itemCount: number;
      }
  >;
};
