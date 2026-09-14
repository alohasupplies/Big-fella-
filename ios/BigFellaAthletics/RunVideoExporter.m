#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>
#include <float.h>

@interface RunVideoExporter : NSObject <RCTBridgeModule>
@end

@interface RCT_EXTERN_MODULE(RunLiveActivity, NSObject)
RCT_EXTERN_METHOD(start:(nonnull NSNumber *)startedAt distanceUnit:(NSString *)distanceUnit)
RCT_EXTERN_METHOD(update:(nonnull NSNumber *)elapsed points:(NSArray *)points paused:(BOOL)paused)
RCT_EXTERN_METHOD(restore:(nonnull NSNumber *)startedAt distanceUnit:(NSString *)distanceUnit elapsed:(nonnull NSNumber *)elapsed points:(NSArray *)points paused:(BOOL)paused)
RCT_EXTERN_METHOD(end)
@end

@implementation RunVideoExporter
RCT_EXPORT_MODULE();

static CATextLayer *BFText(NSString *text, CGFloat size, CGRect frame, NSString *weight) {
  CATextLayer *layer = [CATextLayer layer];
  layer.string = text;
  layer.frame = frame;
  layer.font = (__bridge CFTypeRef)[UIFont fontWithName:weight size:size];
  layer.fontSize = size;
  layer.foregroundColor = UIColor.whiteColor.CGColor;
  layer.contentsScale = UIScreen.mainScreen.scale;
  layer.shadowOpacity = 0.65;
  layer.shadowRadius = 4;
  layer.shadowOffset = CGSizeMake(0, 2);
  return layer;
}

static void BFAnimateDistance(CATextLayer *layer, NSString *distance, CFTimeInterval clipDuration) {
  NSScanner *scanner = [NSScanner scannerWithString:distance];
  double finalValue = 0;
  if (![scanner scanDouble:&finalValue] || finalValue <= 0) return;
  NSString *suffix = [distance substringFromIndex:scanner.scanLocation];
  NSMutableArray<NSString *> *values = [NSMutableArray array];
  const NSInteger frames = 40;
  for (NSInteger index = 0; index <= frames; index++) {
    double progress = (double)index / (double)frames;
    double eased = 1.0 - pow(1.0 - progress, 3.0);
    [values addObject:[NSString stringWithFormat:@"%.2f%@", finalValue * eased, suffix]];
  }
  CAKeyframeAnimation *animation = [CAKeyframeAnimation animationWithKeyPath:@"string"];
  animation.values = values;
  animation.calculationMode = kCAAnimationDiscrete;
  animation.beginTime = AVCoreAnimationBeginTimeAtZero + 0.15;
  animation.duration = MIN(2.4, MAX(0.8, clipDuration * 0.45));
  animation.fillMode = kCAFillModeForwards;
  animation.removedOnCompletion = NO;
  [layer addAnimation:animation forKey:@"distanceTally"];
}

RCT_REMAP_METHOD(exportVideo,
                 source:(NSString *)source
                 distance:(NSString *)distance
                 time:(NSString *)time
                 pace:(NSString *)pace
                 routeJSON:(NSString *)routeJSON
                 showRoute:(BOOL)showRoute
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject) {
  NSURL *url = [NSURL URLWithString:source];
  if (!url.isFileURL) url = [NSURL fileURLWithPath:source];
  AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:nil];
  AVAssetTrack *track = [asset tracksWithMediaType:AVMediaTypeVideo].firstObject;
  if (!track) { reject(@"no_video", @"The selected file has no video track.", nil); return; }

  CMTime limit = CMTimeMakeWithSeconds(10, 600);
  if (CMTimeCompare(asset.duration, limit) >= 0) { reject(@"video_too_long", @"Video must be under 10 seconds.", nil); return; }
  CMTime duration = asset.duration;
  AVMutableComposition *composition = [AVMutableComposition composition];
  AVMutableCompositionTrack *videoTrack = [composition addMutableTrackWithMediaType:AVMediaTypeVideo preferredTrackID:kCMPersistentTrackID_Invalid];
  NSError *insertError = nil;
  [videoTrack insertTimeRange:CMTimeRangeMake(kCMTimeZero, duration) ofTrack:track atTime:kCMTimeZero error:&insertError];
  if (insertError) { reject(@"insert_failed", insertError.localizedDescription, insertError); return; }
  videoTrack.preferredTransform = track.preferredTransform;
  AVAssetTrack *audio = [asset tracksWithMediaType:AVMediaTypeAudio].firstObject;
  if (audio) {
    AVMutableCompositionTrack *audioTrack = [composition addMutableTrackWithMediaType:AVMediaTypeAudio preferredTrackID:kCMPersistentTrackID_Invalid];
    [audioTrack insertTimeRange:CMTimeRangeMake(kCMTimeZero, duration) ofTrack:audio atTime:kCMTimeZero error:nil];
  }

  CGSize natural = track.naturalSize;
  CGRect transformed = CGRectApplyAffineTransform((CGRect){CGPointZero, natural}, track.preferredTransform);
  CGSize renderSize = CGSizeMake(fabs(transformed.size.width), fabs(transformed.size.height));
  AVMutableVideoComposition *videoComposition = [AVMutableVideoComposition videoCompositionWithPropertiesOfAsset:composition];
  videoComposition.renderSize = renderSize;
  videoComposition.frameDuration = CMTimeMake(1, 30);

  CALayer *parent = [CALayer layer]; parent.frame = (CGRect){CGPointZero, renderSize};
  CALayer *video = [CALayer layer]; video.frame = parent.frame; [parent addSublayer:video];
  CGFloat scale = renderSize.width / 390.0;
  CAGradientLayer *shade = [CAGradientLayer layer];
  shade.frame = CGRectMake(0, 0, renderSize.width, renderSize.height * .48);
  shade.colors = @[(id)[UIColor colorWithWhite:0 alpha:.82].CGColor, (id)UIColor.clearColor.CGColor];
  shade.startPoint = CGPointMake(.5, 0); shade.endPoint = CGPointMake(.5, 1); [parent addSublayer:shade];
  [parent addSublayer:BFText(@"BIG FELLA ATHLETICS", 12 * scale, CGRectMake(22 * scale, renderSize.height - 48 * scale, renderSize.width, 20 * scale), @"HelveticaNeue-Bold")];
  CGFloat distanceFont = distance.length > 9 ? 35 * scale : 42 * scale;
  CATextLayer *distanceLayer = BFText(distance, distanceFont, CGRectMake(22 * scale, 116 * scale, 158 * scale, 54 * scale), @"HelveticaNeue-Bold");
  distanceLayer.truncationMode = kCATruncationEnd;
  [parent addSublayer:distanceLayer];
  BFAnimateDistance(distanceLayer, distance, CMTimeGetSeconds(duration));
  [parent addSublayer:BFText(@"DISTANCE", 11 * scale, CGRectMake(24 * scale, 90 * scale, 120 * scale, 18 * scale), @"HelveticaNeue-Bold")];
  [parent addSublayer:BFText(time, 18 * scale, CGRectMake(216 * scale, 126 * scale, 150 * scale, 26 * scale), @"HelveticaNeue-Bold")];
  [parent addSublayer:BFText(@"TIME", 10 * scale, CGRectMake(218 * scale, 106 * scale, 90 * scale, 16 * scale), @"HelveticaNeue-Bold")];
  [parent addSublayer:BFText(pace, 18 * scale, CGRectMake(216 * scale, 72 * scale, 150 * scale, 26 * scale), @"HelveticaNeue-Bold")];
  [parent addSublayer:BFText(@"AVG PACE", 10 * scale, CGRectMake(218 * scale, 52 * scale, 120 * scale, 16 * scale), @"HelveticaNeue-Bold")];
  if (showRoute && routeJSON.length > 2) {
    NSData *data = [routeJSON dataUsingEncoding:NSUTF8StringEncoding];
    NSArray *route = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if ([route isKindOfClass:NSArray.class] && route.count > 1) {
      double minLat = DBL_MAX, maxLat = -DBL_MAX, minLon = DBL_MAX, maxLon = -DBL_MAX;
      for (NSDictionary *point in route) {
        double lat = [point[@"latitude"] doubleValue], lon = [point[@"longitude"] doubleValue];
        minLat = MIN(minLat, lat); maxLat = MAX(maxLat, lat); minLon = MIN(minLon, lon); maxLon = MAX(maxLon, lon);
      }
      double latitudeScale = MAX(cos((((minLat + maxLat) / 2.0) * M_PI) / 180.0), .01);
      double projectedWidth = MAX((maxLon - minLon) * latitudeScale, .000001);
      double projectedHeight = MAX(maxLat - minLat, .000001);
      CGFloat boxWidth = renderSize.width * .76, boxHeight = renderSize.height * .46;
      CGFloat routeScale = MIN(boxWidth / projectedWidth, boxHeight / projectedHeight);
      CGFloat drawnWidth = projectedWidth * routeScale, drawnHeight = projectedHeight * routeScale;
      CGFloat left = (renderSize.width - drawnWidth) / 2.0;
      CGFloat bottom = renderSize.height * .33 + (boxHeight - drawnHeight) / 2.0;
      UIBezierPath *path = [UIBezierPath bezierPath];
      for (NSUInteger i = 0; i < route.count; i++) {
        NSDictionary *point = route[i];
        CGFloat x = left + ([point[@"longitude"] doubleValue] - minLon) * latitudeScale * routeScale;
        CGFloat y = bottom + ([point[@"latitude"] doubleValue] - minLat) * routeScale;
        if (i == 0) [path moveToPoint:CGPointMake(x, y)]; else [path addLineToPoint:CGPointMake(x, y)];
      }
      CAShapeLayer *shadow = [CAShapeLayer layer]; shadow.path = path.CGPath; shadow.fillColor = UIColor.clearColor.CGColor; shadow.strokeColor = [UIColor colorWithWhite:0 alpha:.4].CGColor; shadow.lineWidth = 7 * scale; shadow.lineCap = kCALineCapRound; shadow.lineJoin = kCALineJoinRound; [parent addSublayer:shadow];
      CAShapeLayer *trace = [CAShapeLayer layer]; trace.path = path.CGPath; trace.fillColor = UIColor.clearColor.CGColor; trace.strokeColor = [UIColor colorWithRed:.8 green:0 blue:0 alpha:1].CGColor; trace.lineWidth = 4 * scale; trace.lineCap = kCALineCapRound; trace.lineJoin = kCALineJoinRound; [parent addSublayer:trace];
    }
  }
  videoComposition.animationTool = [AVVideoCompositionCoreAnimationTool videoCompositionCoreAnimationToolWithPostProcessingAsVideoLayer:video inLayer:parent];

  NSString *output = [NSTemporaryDirectory() stringByAppendingPathComponent:[NSString stringWithFormat:@"big-fella-run-%@.mp4", NSUUID.UUID.UUIDString]];
  AVAssetExportSession *exporter = [[AVAssetExportSession alloc] initWithAsset:composition presetName:AVAssetExportPreset1280x720];
  exporter.outputURL = [NSURL fileURLWithPath:output]; exporter.outputFileType = AVFileTypeMPEG4; exporter.videoComposition = videoComposition;
  [exporter exportAsynchronouslyWithCompletionHandler:^{
    dispatch_async(dispatch_get_main_queue(), ^{
      if (exporter.status == AVAssetExportSessionStatusCompleted) resolve([NSURL fileURLWithPath:output].absoluteString);
      else reject(@"export_failed", exporter.error.localizedDescription ?: @"Video export failed.", exporter.error);
    });
  }];
}
@end
