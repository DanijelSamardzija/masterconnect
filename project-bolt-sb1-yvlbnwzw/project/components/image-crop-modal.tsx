'use client';

import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { getCroppedImage as cropImageUtil, type CroppedArea } from '@/lib/image-utils';

interface ImageCropModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onCropComplete: (croppedFile: File) => void;
  aspectRatio?: number;
}

export function ImageCropModal({ open, onOpenChange, imageUrl, onCropComplete, aspectRatio = 4/3 }: ImageCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;

    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    });
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];

    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };

  const getCroppedImageArea = (): CroppedArea | null => {
    if (!imageRef.current || !containerRef.current) return null;

    const container = containerRef.current;
    const image = imageRef.current;

    const containerRect = container.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();

    const scaleX = image.naturalWidth / imageRect.width;
    const scaleY = image.naturalHeight / imageRect.height;

    const x = Math.max(0, (containerRect.left - imageRect.left) * scaleX);
    const y = Math.max(0, (containerRect.top - imageRect.top) * scaleY);

    const width = Math.min(
      containerRect.width * scaleX,
      image.naturalWidth - x
    );
    const height = Math.min(
      containerRect.height * scaleY,
      image.naturalHeight - y
    );

    return { x, y, width, height };
  };

  const handleSave = async () => {
    const croppedArea = getCroppedImageArea();
    if (!croppedArea) return;

    try {
      const croppedFile = await cropImageUtil(imageUrl, croppedArea);
      onCropComplete(croppedFile);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to crop image:', error);
    }
  };

  const handleCancel = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            ref={containerRef}
            className="relative w-full bg-black rounded-lg overflow-hidden cursor-move mx-auto touch-none"
            style={{
              aspectRatio: aspectRatio.toString(),
              maxWidth: aspectRatio === 1 ? '400px' : '100%'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Crop preview"
              draggable={false}
              className="absolute pointer-events-none select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                maxWidth: 'none',
                width: 'auto',
                height: 'auto',
                minWidth: '100%',
                minHeight: '100%'
              }}
            />
          </div>

          <div className="flex items-center gap-4">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              onValueChange={handleZoomChange}
              min={0.5}
              max={2}
              step={0.1}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Drag to reposition • Use slider to zoom
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-orange-600 hover:bg-orange-700">
            Apply Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
