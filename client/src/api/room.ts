import { useMutation, useQuery } from "@tanstack/react-query";
import axios, { AxiosInstance } from "axios";

type CreateRoomRequest = {
    password: string;
    host_name: string;
}

type CreateRoomResponse = {
    room_id: string;
    player_id: string;
}

type JoinRoomRequest = {
    room_id: string;
    password: string;
    player_name: string;
}

type JoinRoomResponse = {
    room_id: string;
    player_id: string;
}

export const createRoom = async (
    axios: AxiosInstance,
    request: CreateRoomRequest
): Promise<CreateRoomResponse> => {
    const res = await axios.post("/api/rooms", request);
    return res.data;
}

export const joinRoom = async (
    axios: AxiosInstance,
    request: JoinRoomRequest
): Promise<JoinRoomResponse> => {
    const res = await axios.post("/api/rooms/join", request);
    return res.data;
}

type GetRoomResponse = {
    room_id: string;
    player_count: number;
}

export const getRoom = async (
    axios: AxiosInstance,
    roomId: string
): Promise<GetRoomResponse> => {
    const res = await axios.get(`/api/rooms/${roomId}`);
    return res.data;
}

export const useGetRoom = (roomId: string) => {
    return useQuery<GetRoomResponse, Error>({
        queryKey: ["room", roomId],
        queryFn: () => getRoom(axios, roomId),
        enabled: !!roomId,
        retry: false,
    });
}

export const useCreateRoom = () => {
    return useMutation<CreateRoomResponse, Error, CreateRoomRequest>({
        mutationFn: (request) => createRoom(axios, request),
    });
}

export const useJoinRoom = () => {
    return useMutation<JoinRoomResponse, Error, JoinRoomRequest>({
        mutationFn: (request) => joinRoom(axios, request),
    });
}
