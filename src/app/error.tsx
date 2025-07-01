"use client"

export default function ErrorPage() {
    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground">Please try again later</p>
        </div>
    )
}