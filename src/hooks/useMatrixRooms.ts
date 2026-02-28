import { useQuery } from "@tanstack/react-query";
import { getJoinedRooms, getRoomName } from "@/api/matrix-rooms";
import { useTokenContext } from "@/auth/TokenContext";
import type { MatrixRoom } from "@/types";

export function useMatrixRooms() {
  const { matrixToken } = useTokenContext();

  return useQuery<MatrixRoom[]>({
    queryKey: ["matrix-rooms"],
    enabled: Boolean(matrixToken),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const response = await getJoinedRooms();
      const roomIds = response.joined_rooms;

      const entries = await Promise.all(
        roomIds.map(async (roomId) => {
          try {
            const roomName = await getRoomName(roomId);
            return {
              room_id: roomId,
              name: roomName.name,
            } satisfies MatrixRoom;
          } catch {
            return {
              room_id: roomId,
              name: roomId,
            } satisfies MatrixRoom;
          }
        }),
      );

      entries.sort((a, b) => (a.name ?? a.room_id).localeCompare(b.name ?? b.room_id));
      return entries;
    },
  });
}
