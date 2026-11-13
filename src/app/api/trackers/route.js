import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Tracker from "@/models/Tracker";

export async function GET() {
  await connectDB();
  const trackers = await Tracker.find({}).sort({ createdAt: -1 });
  return NextResponse.json(trackers);
}

export async function POST(request) {
  await connectDB();
  const body = await request.json();

  const tracker = await Tracker.create({
    movieTitle: body.movieTitle,
    movieCode: body.movieCode,
    movieSlug: body.movieSlug,
    citySlug: body.citySlug || "kochi",
    cityCode: body.cityCode || "KOCH",
    targetDate: body.targetDate,
    targetTheatres: body.targetTheatres || [],
    notifyTelegram: body.notifyTelegram ?? true,
    notifyEmail: body.notifyEmail ?? true,
  });

  return NextResponse.json(tracker, { status: 201 });
}