interface props {
    params: Promise<{
        projectId: string
    }>
}

export default async function ProjectIdPage({ params }: props) {
    const { projectId } = await params

    return (
        <div>
            <h1>ProjectId: {projectId}</h1>
        </div>
    )
}