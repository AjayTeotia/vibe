import { TreeItem } from "@/types";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarProvider,
    SidebarRail
} from "@/components/ui/sidebar"
import { ChevronRightIcon, FileIcon, FolderIcon } from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface TreeViewProps {
    data: TreeItem[];
    value?: string | null;
    onSelect: (value: string) => void;

}

export function TreeView({
    data,
    value,
    onSelect
}: TreeViewProps) {
    return (
        <SidebarProvider>
            <Sidebar collapsible="none" className="w-full">
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {data.map((item, index) => (
                                    <Tree
                                        key={index}
                                        item={item}
                                        selectedValue={value}
                                        onSelect={onSelect}
                                        parentNode=""
                                    />
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent> 
                    </SidebarGroup>
                </SidebarContent>

                <SidebarRail />
            </Sidebar>
        </SidebarProvider>
    )
}

interface TreeProps {
    item: TreeItem
    selectedValue?: string | null
    onSelect: (value: string) => void
    parentNode?: string
}

function Tree({
    item,
    selectedValue,
    onSelect,
    parentNode
}: TreeProps) {
    const [name, ...items] = Array.isArray(item) ? item : [item];
    const currentPath = parentNode ? `${parentNode}/${name}` : name;

    if (!items.length) {
        // It's a file
        const isSelected = selectedValue === currentPath;

        return (
            <SidebarMenuButton
                isActive={isSelected}
                className="data-[active=true]:bg-transparent"
                onClick={() => onSelect?.(currentPath)}
            >
                <FileIcon />

                <span className="truncate">{name}</span>
            </SidebarMenuButton>
        )
    }

    // It's a folder
    return (
        <SidebarMenuItem>
            <Collapsible
                className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
                defaultOpen
            >
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                        <ChevronRightIcon className="transition-transform" />

                        <FolderIcon />

                        <span className="truncate">
                            {name}
                        </span>
                    </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <SidebarMenuSub>
                        {items.map((subItem, index) => (
                            <Tree
                                key={index}
                                item={subItem}
                                selectedValue={selectedValue}
                                onSelect={onSelect}
                                parentNode={currentPath}
                            />
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
        </SidebarMenuItem>
    )
}