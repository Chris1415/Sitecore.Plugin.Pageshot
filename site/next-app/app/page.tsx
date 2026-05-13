import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function IntroPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-foreground mb-6 tracking-tight">
            PageShot
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            One-button capture-screenshot panel for SitecoreAI Pages. Click
            Capture, get a clean chrome-free screenshot of the page you are
            editing, then Copy it to clipboard, Download as PNG, or Open it in
            a new tab. The image is rendered server-side via the SitecoreAI
            Agent API — no editor toolbars, no sidebars, no OS-level capture
            tooling required.
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 mb-16 border border-border/50">
          <h2 className="text-2xl font-semibold mb-6 text-center">
            Project Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="font-medium text-foreground">Title</div>
              <div className="text-muted-foreground">PageShot</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-foreground">Author</div>
              <div className="text-muted-foreground">Christian Hahn</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-foreground">Version</div>
              <div className="text-muted-foreground">1.0.0</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-foreground">Released at (V1)</div>
              <div className="text-muted-foreground">23.04.2026</div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="font-medium text-foreground">
                Extension Points
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Pages Context Panel</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 max-w-2xl mx-auto gap-8">
          <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">
                Pages Context Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex flex-col flex-grow">
              <div className="bg-muted rounded-lg overflow-hidden">
                <Image
                  src="/panel.png"
                  alt="PageShot panel docked in the SitecoreAI Pages editor"
                  width={720}
                  height={400}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <CardDescription className="text-sm leading-relaxed flex-grow">
                Docks into the SitecoreAI Pages editor as a Page Builder Context
                Panel. Capture Mobile (375 px) or Desktop (1200 px) or both, at
                four height presets from Small (800 px) to Full (8 000 px). The
                Agent API renders the page chrome-free; the panel auto-trims
                any trailing whitespace, then offers Copy / Download / Open per
                capture. Disabled-state messaging surfaces auth, not-found,
                upstream, network, and unknown errors honestly — never
                silently.
              </CardDescription>
              <Link href="/panel" className="mt-auto mb-2">
                <Button variant="outline" className="w-full bg-transparent">
                  Open Panel
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
