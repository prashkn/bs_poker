import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";

export type CreateRoomRequest = {
    password: string;
    host_name: string;
}

type CreateRoomResponse = {
    room_id: string;
    player_id: string;
}

export const createRoom = async (
    request: CreateRoomRequest
): Promise<CreateRoomResponse> => {
    const res = await axios.post("/api/rooms", request);
    return res.data;
}

export const useCreateRoom = () => {
    return useMutation<CreateRoomResponse, Error, CreateRoomRequest>({
        mutationFn: (request) => createRoom(request),
    });
}

export type JoinRoomRequest = {
    room_id: string;
    password: string;
    player_name: string;
}

type JoinRoomResponse = {
    room_id: string;
    player_id: string;
}

export const joinRoom = async (
    request: JoinRoomRequest
): Promise<JoinRoomResponse> => {
    const res = await axios.post(`/api/rooms/${request.room_id}/join`, request);
    return res.data;
}

export const useJoinRoom = () => {
    return useMutation<JoinRoomResponse, Error, JoinRoomRequest>({
        mutationFn: (request) => joinRoom(request),
    });
}

export type GetRoomRequest = {
    room_id: string;
    player_id: string;
}

type GetRoomResponse = {}

export const getRoom = async (
    request: GetRoomRequest
): Promise<GetRoomResponse> => {
    const params = request.player_id ? { player_id: request.player_id } : undefined;
    const res = await axios.get(`/api/rooms/${request.room_id}`, { params });
    return res.data;
}

export const useGetRoom = (request: GetRoomRequest) => {
    return useQuery<GetRoomResponse, Error>({
        queryKey: ["room", request.room_id, request.player_id],
        queryFn: () => getRoom(request),
        enabled: !!request.room_id,
        retry: false,
    });
}