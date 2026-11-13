import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Tracker from "@/models/Tracker";

export async function PATCH(request, { params }) {
    await connectDB();
    const { id } = await params;
    const updates = await request.json();
    const updated = await Tracker.findByIdAndUpdate(id, updates, { new: true });
    return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
    await connectDB();
    const { id } = await params;
    await Tracker.findByIdAndDelete(id);
    return NextResponse.json({ deleted: true });
}