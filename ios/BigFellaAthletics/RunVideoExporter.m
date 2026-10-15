#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreText/CoreText.h>
#import <UIKit/UIKit.h>
#import <MapKit/MapKit.h>
#import <HealthKit/HealthKit.h>
#include <float.h>

@interface RunVideoExporter : NSObject <RCTBridgeModule>
@end

@interface RCT_EXTERN_MODULE(RunLiveActivity, NSObject)
RCT_EXTERN_METHOD(start:(nonnull NSNumber *)startedAt distanceUnit:(NSString *)distanceUnit)
RCT_EXTERN_METHOD(startSession:(nonnull NSNumber *)startedAt distanceUnit:(NSString *)distanceUnit mode:(NSString *)mode)
RCT_EXTERN_METHOD(update:(nonnull NSNumber *)elapsed points:(NSArray *)points paused:(BOOL)paused)
RCT_EXTERN_METHOD(restore:(nonnull NSNumber *)startedAt distanceUnit:(NSString *)distanceUnit elapsed:(nonnull NSNumber *)elapsed points:(NSArray *)points paused:(BOOL)paused)
RCT_EXTERN_METHOD(restoreSession:(nonnull NSNumber *)startedAt distanceUnit:(NSString *)distanceUnit elapsed:(nonnull NSNumber *)elapsed points:(NSArray *)points paused:(BOOL)paused mode:(NSString *)mode)
RCT_EXTERN_METHOD(end)
@end

@implementation RunVideoExporter
RCT_EXPORT_MODULE();

// The installed HealthKit library force-unwraps route-query errors. Query here
// so locked Health data or denied access rejects safely instead of crashing.
RCT_REMAP_METHOD(readHealthRoute,
                 workoutUUID:(NSString *)workoutUUID
                 healthResolver:(RCTPromiseResolveBlock)resolve
                 healthRejecter:(RCTPromiseRejectBlock)reject) {
  NSUUID *uuid = [[NSUUID alloc] initWithUUIDString:workoutUUID];
  if (!uuid || !HKHealthStore.isHealthDataAvailable) { resolve(@[]); return; }
  HKHealthStore *store = [HKHealthStore new];
  HKSampleQuery *workoutQuery = [[HKSampleQuery alloc] initWithSampleType:HKObjectType.workoutType
    predicate:[HKQuery predicateForObjectWithUUID:uuid] limit:1 sortDescriptors:nil
    resultsHandler:^(HKSampleQuery *query, NSArray<HKSample *> *samples, NSError *error) {
      if (error) { reject(@"health_route_failed", error.localizedDescription, error); return; }
      HKWorkout *workout = (HKWorkout *)samples.firstObject;
      if (!workout) { resolve(@[]); return; }
      HKSampleQuery *routesQuery = [[HKSampleQuery alloc] initWithSampleType:HKSeriesType.workoutRouteType
        predicate:[HKQuery predicateForObjectsFromWorkout:workout] limit:HKObjectQueryNoLimit sortDescriptors:nil
        resultsHandler:^(HKSampleQuery *query, NSArray<HKSample *> *routes, NSError *error) {
          if (error) { reject(@"health_route_failed", error.localizedDescription, error); return; }
          if (!routes.count) { resolve(@[]); return; }
          NSMutableArray<CLLocation *> *locations = [NSMutableArray array];
          dispatch_group_t group = dispatch_group_create();
          __block NSError *routeError = nil;
          for (HKWorkoutRoute *route in routes) {
            dispatch_group_enter(group);
            __block BOOL finished = NO;
            HKWorkoutRouteQuery *locationQuery = [[HKWorkoutRouteQuery alloc] initWithRoute:route
              dataHandler:^(HKWorkoutRouteQuery *query, NSArray<CLLocation *> *batch, BOOL done, NSError *error) {
                @synchronized (locations) {
                  if (finished) return;
                  if (error) routeError = error;
                  else if (batch) [locations addObjectsFromArray:batch];
                  if (done || error) { finished = YES; dispatch_group_leave(group); }
                }
              }];
            [store executeQuery:locationQuery];
          }
          dispatch_group_notify(group, dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
            if (routeError) { reject(@"health_route_failed", routeError.localizedDescription, routeError); return; }
            [locations sortUsingComparator:^NSComparisonResult(CLLocation *a, CLLocation *b) { return [a.timestamp compare:b.timestamp]; }];
            NSMutableArray *points = [NSMutableArray array];
            CLLocation *previous = nil;
            for (CLLocation *location in locations) {
              if (!CLLocationCoordinate2DIsValid(location.coordinate) || location.horizontalAccuracy < 0) continue;
              if (previous && [previous.timestamp isEqualToDate:location.timestamp] &&
                  previous.coordinate.latitude == location.coordinate.latitude && previous.coordinate.longitude == location.coordinate.longitude) continue;
              [points addObject:@{@"latitude": @(location.coordinate.latitude), @"longitude": @(location.coordinate.longitude),
                @"timestamp": @(location.timestamp.timeIntervalSince1970 * 1000)}];
              previous = location;
            }
            resolve(points);
          });
        }];
      [store executeQuery:routesQuery];
    }];
  [store executeQuery:workoutQuery];
}

static CATextLayer *BFText(NSString *text, CGFloat size, CGRect frame, NSString *weight) {
  CATextLayer *layer = [CATextLayer layer];
  layer.string = text;
  layer.frame = frame;
  CTFontRef font = CTFontCreateWithName((__bridge CFStringRef)weight, size, NULL);
  layer.font = font;
  CFRelease(font);
  layer.fontSize = size;
  layer.foregroundColor = UIColor.whiteColor.CGColor;
  layer.contentsScale = UIScreen.mainScreen.scale;
  layer.shadowOpacity = 0.65;
  layer.shadowRadius = 4;
  layer.shadowOffset = CGSizeMake(0, 2);
  return layer;
}

static CGFloat BFFittingFontSize(NSString *text, NSString *weight, CGFloat preferredSize,
                                 CGFloat minimumSize, CGFloat availableWidth) {
  CGFloat size = preferredSize;
  while (size > minimumSize) {
    UIFont *font = [UIFont fontWithName:weight size:size] ?: [UIFont boldSystemFontOfSize:size];
    CGFloat width = [text sizeWithAttributes:@{NSFontAttributeName: font}].width;
    if (width <= availableWidth) break;
    size -= 1.0;
  }
  return MAX(size, minimumSize);
}

static UIImage *BFLogoImageForVideo(UIImage *source, CGSize pixelSize) {
  if (!source || pixelSize.width < 1 || pixelSize.height < 1) return source;
  UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
  format.opaque = NO;
  // Video-composition layer coordinates are pixels. Rendering at a 1x scale
  // creates an exact-size bitmap and avoids Core Animation re-sampling the
  // logo during every encoded frame.
  format.scale = 1.0;
  UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:pixelSize format:format];
  return [renderer imageWithActions:^(UIGraphicsImageRendererContext * _Nonnull rendererContext) {
    CGContextRef context = rendererContext.CGContext;
    CGContextSetInterpolationQuality(context, kCGInterpolationHigh);
    CGSize sourceSize = source.size;
    CGFloat fit = MIN(pixelSize.width / sourceSize.width, pixelSize.height / sourceSize.height);
    CGSize drawSize = CGSizeMake(sourceSize.width * fit, sourceSize.height * fit);
    CGRect drawRect = CGRectMake((pixelSize.width - drawSize.width) / 2.0,
                                 (pixelSize.height - drawSize.height) / 2.0,
                                 drawSize.width, drawSize.height);
    [source drawInRect:drawRect blendMode:kCGBlendModeNormal alpha:1.0];
  }];
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
  // The video composition instruction owns orientation. Applying it here as well
  // can move the frames outside the render canvas and produce a black export.
  videoTrack.preferredTransform = CGAffineTransformIdentity;
  AVAssetTrack *audio = [asset tracksWithMediaType:AVMediaTypeAudio].firstObject;
  if (audio) {
    AVMutableCompositionTrack *audioTrack = [composition addMutableTrackWithMediaType:AVMediaTypeAudio preferredTrackID:kCMPersistentTrackID_Invalid];
    [audioTrack insertTimeRange:CMTimeRangeMake(kCMTimeZero, duration) ofTrack:audio atTime:kCMTimeZero error:nil];
  }

  CGSize natural = track.naturalSize;
  CGRect transformed = CGRectApplyAffineTransform((CGRect){CGPointZero, natural}, track.preferredTransform);
  CGSize sourceSize = CGSizeMake(fabs(transformed.size.width), fabs(transformed.size.height));
  if (!isfinite(sourceSize.width) || !isfinite(sourceSize.height) || sourceSize.width < 1 || sourceSize.height < 1) {
    reject(@"invalid_video_size", @"The selected video has an invalid size.", nil); return;
  }
  CGFloat maxDimension = 1280.0;
  CGFloat downscale = MIN(1.0, maxDimension / MAX(sourceSize.width, sourceSize.height));
  CGSize renderSize = CGSizeMake(MAX(2, floor(sourceSize.width * downscale / 2) * 2),
                                 MAX(2, floor(sourceSize.height * downscale / 2) * 2));
  AVMutableVideoComposition *videoComposition = [AVMutableVideoComposition videoComposition];
  videoComposition.renderSize = renderSize;
  videoComposition.frameDuration = CMTimeMake(1, 30);
  // Normalize the oriented source rectangle into the output rectangle in
  // destination coordinates. CGAffineTransformTranslate/Scale would apply the
  // adjustments in the transform's rotated coordinate system instead.
  CGFloat xScale = renderSize.width / sourceSize.width;
  CGFloat yScale = renderSize.height / sourceSize.height;
  CGAffineTransform sourceTransform = track.preferredTransform;
  CGAffineTransform outputTransform = CGAffineTransformMake(
      sourceTransform.a * xScale, sourceTransform.b * yScale,
      sourceTransform.c * xScale, sourceTransform.d * yScale,
      (sourceTransform.tx - transformed.origin.x) * xScale,
      (sourceTransform.ty - transformed.origin.y) * yScale);
  AVMutableVideoCompositionLayerInstruction *layerInstruction =
      [AVMutableVideoCompositionLayerInstruction videoCompositionLayerInstructionWithAssetTrack:videoTrack];
  [layerInstruction setTransform:outputTransform atTime:kCMTimeZero];
  AVMutableVideoCompositionInstruction *instruction = [AVMutableVideoCompositionInstruction videoCompositionInstruction];
  instruction.timeRange = CMTimeRangeMake(kCMTimeZero, duration);
  instruction.layerInstructions = @[layerInstruction];
  videoComposition.instructions = @[instruction];

  CALayer *parent = [CALayer layer]; parent.frame = (CGRect){CGPointZero, renderSize};
  CALayer *video = [CALayer layer]; video.frame = parent.frame; [parent addSublayer:video];
  CGFloat scale = renderSize.width / 390.0;
  CAGradientLayer *shade = [CAGradientLayer layer];
  shade.frame = CGRectMake(0, 0, renderSize.width, renderSize.height * .48);
  shade.colors = @[(id)[UIColor colorWithWhite:0 alpha:.82].CGColor, (id)UIColor.clearColor.CGColor];
  shade.startPoint = CGPointMake(.5, 0); shade.endPoint = CGPointMake(.5, 1); [parent addSublayer:shade];
  UIImage *brandLogo = [UIImage imageNamed:@"AthleticcsLogo"];
  if (brandLogo.CGImage) {
    CGSize logoPixelSize = CGSizeMake(round(104 * scale), round(66 * scale));
    UIImage *videoLogo = BFLogoImageForVideo(brandLogo, logoPixelSize);
    CALayer *logoLayer = [CALayer layer];
    logoLayer.contents = (__bridge id)videoLogo.CGImage;
    logoLayer.contentsScale = 1.0;
    logoLayer.contentsGravity = kCAGravityResize;
    logoLayer.minificationFilter = kCAFilterTrilinear;
    logoLayer.magnificationFilter = kCAFilterLinear;
    logoLayer.allowsEdgeAntialiasing = YES;
    // Export coordinates start at the bottom. Place the logo beneath the
    // distance label, aligned with the distance column and clear of pace/time.
    logoLayer.frame = CGRectMake(round(22 * scale), round(18 * scale),
                                 logoPixelSize.width, logoPixelSize.height);
    [parent addSublayer:logoLayer];
  }
  CGFloat distanceWidth = 184 * scale;
  CGFloat distanceFont = BFFittingFontSize(distance, @"HelveticaNeue-Bold", 42 * scale,
                                           25 * scale, distanceWidth - (4 * scale));
  CATextLayer *distanceLayer = BFText(distance, distanceFont,
                                      CGRectMake(22 * scale, 116 * scale, distanceWidth, 54 * scale),
                                      @"HelveticaNeue-Bold");
  distanceLayer.truncationMode = kCATruncationNone;
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
  if (!exporter) { reject(@"export_unavailable", @"This video cannot be exported on this device.", nil); return; }
  if (![exporter.supportedFileTypes containsObject:AVFileTypeMPEG4]) {
    reject(@"unsupported_video", @"This video cannot be saved as MP4.", nil); return;
  }
  exporter.outputURL = [NSURL fileURLWithPath:output]; exporter.outputFileType = AVFileTypeMPEG4; exporter.videoComposition = videoComposition;
  [exporter exportAsynchronouslyWithCompletionHandler:^{
    dispatch_async(dispatch_get_main_queue(), ^{
      if (exporter.status == AVAssetExportSessionStatusCompleted) resolve([NSURL fileURLWithPath:output].absoluteString);
      else reject(@"export_failed", exporter.error.localizedDescription ?: @"Video export failed.", exporter.error);
    });
  }];
}
RCT_REMAP_METHOD(create3DMap,
                 mapRouteJSON:(NSString *)routeJSON
                 mapResolver:(RCTPromiseResolveBlock)resolve
                 mapRejecter:(RCTPromiseRejectBlock)reject) {
  NSArray *route = [NSJSONSerialization JSONObjectWithData:[routeJSON dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  if (![route isKindOfClass:NSArray.class] || route.count < 2) { reject(@"missing_route", @"A GPS route is needed for a 3D recap.", nil); return; }
  MKMapRect bounds = MKMapRectNull;
  for (NSDictionary *point in route) {
    CLLocationCoordinate2D coordinate = CLLocationCoordinate2DMake([point[@"latitude"] doubleValue], [point[@"longitude"] doubleValue]);
    if (!CLLocationCoordinate2DIsValid(coordinate)) { reject(@"invalid_route", @"The GPS route contains invalid coordinates.", nil); return; }
    MKMapPoint p = MKMapPointForCoordinate(coordinate);
    bounds = MKMapRectUnion(bounds, MKMapRectMake(p.x, p.y, 1, 1));
  }
  CLLocationCoordinate2D center = MKCoordinateForMapPoint(MKMapPointMake(MKMapRectGetMidX(bounds), MKMapRectGetMidY(bounds)));
  double span = MAX(bounds.size.width, bounds.size.height) * MKMetersPerMapPointAtLatitude(center.latitude);
  MKMapCamera *camera = [MKMapCamera cameraLookingAtCenterCoordinate:center fromDistance:MAX(900, span * 2.4) pitch:55 heading:0];
  [self snapshot3DRoute:route camera:camera attempt:0 resolve:resolve reject:reject];
}

- (void)snapshot3DRoute:(NSArray *)route camera:(MKMapCamera *)camera attempt:(NSUInteger)attempt
               resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  MKMapSnapshotOptions *options = [MKMapSnapshotOptions new];
  options.size = CGSizeMake(1080, 837);
  options.scale = 1;
  options.camera = camera;
  options.mapType = MKMapTypeHybridFlyover;
  options.showsBuildings = YES;
  MKMapSnapshotter *snapshotter = [[MKMapSnapshotter alloc] initWithOptions:options];
  [snapshotter startWithQueue:dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0) completionHandler:^(MKMapSnapshot *snapshot, NSError *error) {
    if (!snapshot) { reject(@"map_failed", error.localizedDescription ?: @"Could not load the 3D map. Check your connection and try again.", error); return; }
    UIBezierPath *trace = [UIBezierPath bezierPath];
    BOOL fits = YES;
    // Keep the route below the recap logo and clear of Apple's attribution.
    CGRect safe = CGRectMake(60, 210, 960, 557);
    for (NSUInteger i = 0; i < route.count; i++) {
      CGPoint point = [snapshot pointForCoordinate:CLLocationCoordinate2DMake([route[i][@"latitude"] doubleValue], [route[i][@"longitude"] doubleValue])];
      if (!isfinite(point.x) || !isfinite(point.y)) { reject(@"map_failed", @"Could not position this route on the 3D map.", nil); return; }
      fits = fits && CGRectContainsPoint(safe, point);
      if (i == 0) [trace moveToPoint:point]; else [trace addLineToPoint:point];
    }
    if (!fits) {
      if (attempt >= 7) { reject(@"map_failed", @"Could not fit this route in 3D. Try the Map recap instead.", nil); return; }
      MKMapCamera *wider = [camera copy];
      wider.centerCoordinateDistance *= 1.4;
      [self snapshot3DRoute:route camera:wider attempt:attempt + 1 resolve:resolve reject:reject];
      return;
    }
    UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat];
    format.scale = 1; format.opaque = YES;
    UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:options.size format:format];
    UIImage *image = [renderer imageWithActions:^(UIGraphicsImageRendererContext *context) {
      [snapshot.image drawAtPoint:CGPointZero];
      trace.lineCapStyle = kCGLineCapRound; trace.lineJoinStyle = kCGLineJoinRound;
      [[[UIColor blackColor] colorWithAlphaComponent:0.7] setStroke];
      trace.lineWidth = 15; [trace stroke];
      [[UIColor colorWithRed:0.88 green:0 blue:0 alpha:1] setStroke];
      trace.lineWidth = 9; [trace stroke];
    }];
    NSString *path = [NSTemporaryDirectory() stringByAppendingPathComponent:[NSString stringWithFormat:@"athleticcs-3d-%@.png", NSUUID.UUID.UUIDString]];
    NSError *writeError;
    if (![UIImagePNGRepresentation(image) writeToFile:path options:NSDataWritingAtomic error:&writeError]) {
      reject(@"map_failed", @"Could not save the 3D map.", writeError); return;
    }
    resolve([NSURL fileURLWithPath:path].absoluteString);
  }];
}

RCT_REMAP_METHOD(exportRewind,
                 routeJSON:(NSString *)routeJSON
                 distance:(double)distance
                 unit:(NSString *)unit
                 time:(NSString *)time
                 pace:(NSString *)pace
                 rewindResolver:(RCTPromiseResolveBlock)resolve
                 rewindRejecter:(RCTPromiseRejectBlock)reject) {
  [self exportRouteVideo:routeJSON distance:distance unit:unit time:time pace:pace flyover:NO resolve:resolve reject:reject];
}

RCT_REMAP_METHOD(exportFlyover,
                 flyoverRouteJSON:(NSString *)routeJSON
                 flyoverDistance:(double)distance
                 flyoverUnit:(NSString *)unit
                 flyoverTime:(NSString *)time
                 flyoverPace:(NSString *)pace
                 flyoverResolver:(RCTPromiseResolveBlock)resolve
                 flyoverRejecter:(RCTPromiseRejectBlock)reject) {
  [self exportRouteVideo:routeJSON distance:distance unit:unit time:time pace:pace flyover:YES resolve:resolve reject:reject];
}

- (void)replaySnapshot:(MKMapSnapshotOptions *)options route:(NSArray *)route attempt:(NSUInteger)attempt
           completion:(void (^)(MKMapSnapshot *, NSError *))completion {
  MKMapSnapshotter *snapshotter = [[MKMapSnapshotter alloc] initWithOptions:options];
  [snapshotter startWithQueue:dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0) completionHandler:^(MKMapSnapshot *snapshot, NSError *error) {
    if (!snapshot) { completion(nil, error); return; }
    BOOL fits = YES;
    for (NSDictionary *point in route) {
      CGPoint p = [snapshot pointForCoordinate:CLLocationCoordinate2DMake([point[@"latitude"] doubleValue], [point[@"longitude"] doubleValue])];
      fits = fits && isfinite(p.x) && isfinite(p.y) && CGRectContainsPoint(CGRectMake(60, 280, 1320, 980), p);
    }
    if (!fits && attempt < 6) {
      if (options.mapType == MKMapTypeHybridFlyover) {
        MKMapCamera *camera = [options.camera copy]; camera.centerCoordinateDistance *= 1.3; options.camera = camera;
      } else {
        MKMapRect rect = options.mapRect;
        options.mapRect = MKMapRectInset(rect, -rect.size.width * .15, -rect.size.height * .15);
      }
      [self replaySnapshot:options route:route attempt:attempt + 1 completion:completion];
    } else if (!fits) {
      completion(nil, [NSError errorWithDomain:@"Athleticcs" code:1 userInfo:@{NSLocalizedDescriptionKey: @"Could not frame the entire route. Please try again."}]);
    } else completion(snapshot, nil);
  }];
}

- (void)exportRouteVideo:(NSString *)routeJSON distance:(double)distance unit:(NSString *)unit
                   time:(NSString *)time pace:(NSString *)pace flyover:(BOOL)flyover
                resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
  NSArray *route = [NSJSONSerialization JSONObjectWithData:[routeJSON dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  if (![route isKindOfClass:NSArray.class] || route.count < 2) { reject(@"missing_route", @"A GPS route is needed for Rewind.", nil); return; }
  MKMapRect bounds = MKMapRectNull;
  NSMutableArray<NSNumber *> *lengths = [NSMutableArray arrayWithObject:@0];
  CLLocation *lastLocation = nil;
  double total = 0;
  for (NSUInteger i = 0; i < route.count; i++) {
    NSDictionary *p = route[i];
    double lat = [p[@"latitude"] doubleValue], lon = [p[@"longitude"] doubleValue];
    if (!CLLocationCoordinate2DIsValid(CLLocationCoordinate2DMake(lat, lon))) { reject(@"invalid_route", @"The GPS route contains invalid coordinates.", nil); return; }
    MKMapPoint point = MKMapPointForCoordinate(CLLocationCoordinate2DMake(lat, lon));
    bounds = MKMapRectUnion(bounds, MKMapRectMake(point.x, point.y, 1, 1));
    CLLocation *location = [[CLLocation alloc] initWithLatitude:lat longitude:lon];
    if (i) {
      total += [location distanceFromLocation:lastLocation]; [lengths addObject:@(total)];
    }
    lastLocation = location;
  }
  CGFloat mapWidth = MAX(bounds.size.width, 500);
  CGFloat mapHeight = MAX(bounds.size.height, 500);
  CGFloat width = MAX(mapWidth / .76, mapHeight / .52 * .8);
  CGFloat height = width / .8;
  MKMapSnapshotOptions *options = [MKMapSnapshotOptions new];
  options.size = CGSizeMake(1440, 1800); options.scale = 1;
  // Leave room for the logo and bottom statistics while fitting the whole route.
  options.mapRect = MKMapRectMake(MKMapRectGetMidX(bounds) - width / 2, MKMapRectGetMidY(bounds) - height * .41, width, height);
  options.mapType = MKMapTypeMutedStandard;
  options.showsBuildings = NO;
  if (flyover) {
    CLLocationCoordinate2D center = MKCoordinateForMapPoint(MKMapPointMake(MKMapRectGetMidX(bounds), MKMapRectGetMidY(bounds) + bounds.size.height * .12));
    double span = MAX(bounds.size.width, bounds.size.height) * MKMetersPerMapPointAtLatitude(center.latitude);
    options.camera = [MKMapCamera cameraLookingAtCenterCoordinate:center fromDistance:MAX(900, span * 3.5) pitch:55 heading:0];
    options.mapType = MKMapTypeHybridFlyover; options.showsBuildings = YES;
  }
  // Advance by distance, not raw sample count or timestamp gaps. GPS batches and
  // pauses must not cause the short recap to stop and jump between points.
  NSArray<NSNumber *> *steps = lengths;
  double totalLength = total;
  UIImage *logo = [UIImage imageNamed:@"AthleticcsLogo"];
  [self replaySnapshot:options route:route attempt:0 completion:^(MKMapSnapshot *snapshot, NSError *snapshotError) {
    if (!snapshot) { reject(@"map_failed", snapshotError.localizedDescription ?: @"Could not load the map. Check your connection and try again.", snapshotError); return; }
    NSString *path = [NSTemporaryDirectory() stringByAppendingPathComponent:[NSString stringWithFormat:@"athleticcs-rewind-%@.mp4", NSUUID.UUID.UUIDString]];
    NSError *writerError = nil;
    AVAssetWriter *writer = [[AVAssetWriter alloc] initWithURL:[NSURL fileURLWithPath:path] fileType:AVFileTypeMPEG4 error:&writerError];
    AVAssetWriterInput *input = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo outputSettings:@{AVVideoCodecKey: AVVideoCodecTypeH264, AVVideoWidthKey: @720, AVVideoHeightKey: @900, AVVideoCompressionPropertiesKey: @{AVVideoAverageBitRateKey: @8000000, AVVideoExpectedSourceFrameRateKey: @60, AVVideoMaxKeyFrameIntervalKey: @60}}];
    AVAssetWriterInputPixelBufferAdaptor *adaptor = [AVAssetWriterInputPixelBufferAdaptor assetWriterInputPixelBufferAdaptorWithAssetWriterInput:input sourcePixelBufferAttributes:@{(id)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32ARGB), (id)kCVPixelBufferWidthKey: @720, (id)kCVPixelBufferHeightKey: @900, (id)kCVPixelBufferCGImageCompatibilityKey: @YES, (id)kCVPixelBufferCGBitmapContextCompatibilityKey: @YES}];
    if (!writer || ![writer canAddInput:input]) { reject(@"writer_failed", writerError.localizedDescription ?: @"Could not create Rewind.", writerError); return; }
    [writer addInput:input];
    if (![writer startWriting]) { reject(@"writer_failed", writer.error.localizedDescription, writer.error); return; }
    [writer startSessionAtSourceTime:kCMTimeZero];
    dispatch_queue_t queue = dispatch_queue_create("athleticcs.rewind", DISPATCH_QUEUE_SERIAL);
    __block NSInteger frame = 0;
    NSMutableArray<NSValue *> *projected = [NSMutableArray arrayWithCapacity:route.count];
    for (NSDictionary *p in route) {
      CGPoint point = [snapshot pointForCoordinate:CLLocationCoordinate2DMake([p[@"latitude"] doubleValue], [p[@"longitude"] doubleValue])];
      [projected addObject:[NSValue valueWithCGPoint:CGPointMake(point.x / 2, point.y / 2)]];
    }
    __block CGPoint cameraCenter = projected.firstObject.CGPointValue;
    UIGraphicsImageRendererFormat *format = [UIGraphicsImageRendererFormat defaultFormat]; format.scale = 1; format.opaque = YES;
    UIGraphicsImageRenderer *renderer = [[UIGraphicsImageRenderer alloc] initWithSize:CGSizeMake(720, 900) format:format];
    NSString *finalDistance = [NSString stringWithFormat:@"%.2f", distance];
    CGFloat size = BFFittingFontSize(finalDistance, @"HelveticaNeue-Bold", 64, 26, 370);
    NSDictionary *big = @{NSFontAttributeName: [UIFont monospacedDigitSystemFontOfSize:size weight:UIFontWeightBold], NSForegroundColorAttributeName: UIColor.whiteColor};
    [input requestMediaDataWhenReadyOnQueue:queue usingBlock:^{
      while (input.readyForMoreMediaData && frame < 600) {
        @autoreleasepool {
          double seconds = (double)frame / 60.0;
          double progress = MIN(1, MAX(0, (seconds - .5) / 8.0));
          double target = progress * steps.lastObject.doubleValue;
          NSUInteger index = 1;
          while (index < route.count - 1 && steps[index].doubleValue < target) index++;
          double span = steps[index].doubleValue - steps[index - 1].doubleValue;
          double amount = span > 0 ? (target - steps[index - 1].doubleValue) / span : progress;
          CGPoint a = projected[index - 1].CGPointValue, b = projected[index].CGPointValue;
          CGPoint head = CGPointMake(a.x + (b.x - a.x) * amount, a.y + (b.y - a.y) * amount);
          double fraction = totalLength > 0 ? (lengths[index - 1].doubleValue + (lengths[index].doubleValue - lengths[index - 1].doubleValue) * amount) / totalLength : progress;
          cameraCenter.x += (head.x - cameraCenter.x) * .1;
          cameraCenter.y += (head.y - cameraCenter.y) * .1;
          double intro = MIN(1, seconds / 1.2), outro = MIN(1, MAX(0, (seconds - 8.5) / 1.0));
          double follow = flyover ? (intro * intro * (3 - 2 * intro)) * (1 - outro * outro * (3 - 2 * outro)) : 0;
          CGFloat zoom = 1 + follow * .85;
          // Keep imagery covering the whole canvas while following the runner.
          CGFloat tx = MAX(720 * (1 - zoom), MIN(0, (360 - cameraCenter.x * 1.85) * follow));
          CGFloat ty = MAX(900 * (1 - zoom), MIN(0, (375 - cameraCenter.y * 1.85) * follow));
          UIImage *image = [renderer imageWithActions:^(UIGraphicsImageRendererContext *ctx) {
            CGContextSaveGState(ctx.CGContext);
            CGContextTranslateCTM(ctx.CGContext, tx, ty); CGContextScaleCTM(ctx.CGContext, zoom, zoom);
            [snapshot.image drawInRect:CGRectMake(0, 0, 720, 900)];
            UIBezierPath *trace = [UIBezierPath bezierPath];
            for (NSUInteger i = 0; i < index; i++) {
              CGPoint point = projected[i].CGPointValue;
              if (!i) [trace moveToPoint:point]; else [trace addLineToPoint:point];
            }
            [trace addLineToPoint:head];
            trace.lineWidth = 10 / zoom; trace.lineCapStyle = kCGLineCapRound; trace.lineJoinStyle = kCGLineJoinRound;
            [[UIColor colorWithWhite:0 alpha:.65] setStroke]; [trace stroke];
            trace.lineWidth = 6 / zoom;
            [[UIColor colorWithRed:.8 green:0 blue:0 alpha:1] setStroke]; [trace stroke];
            CGContextRestoreGState(ctx.CGContext);
            [[UIColor colorWithWhite:0 alpha:.86] setFill]; UIRectFill(CGRectMake(0, 660, 720, 240));
            [logo drawInRect:CGRectMake(28, 24, 180, 114)];
            NSDictionary *small = @{NSFontAttributeName: [UIFont boldSystemFontOfSize:17], NSForegroundColorAttributeName: UIColor.whiteColor};
            [[NSString stringWithFormat:@"%.2f", distance * fraction] drawAtPoint:CGPointMake(32, 690) withAttributes:big];
            [unit.uppercaseString drawAtPoint:CGPointMake(34, 774) withAttributes:small];
            [(flyover ? @"3D FLYOVER" : @"RUN REWIND") drawAtPoint:CGPointMake(34, 670) withAttributes:small];
            [time drawAtPoint:CGPointMake(430, 704) withAttributes:small];
            [@"TIME" drawAtPoint:CGPointMake(430, 734) withAttributes:small];
            [[NSString stringWithFormat:@"%@ /%@", pace, [unit isEqualToString:@"miles"] ? @"mi" : @"km"] drawAtPoint:CGPointMake(430, 780) withAttributes:small];
            [@"AVG PACE" drawAtPoint:CGPointMake(430, 810) withAttributes:small];
          }];
          CVPixelBufferRef buffer = NULL;
          CVReturn status = adaptor.pixelBufferPool ? CVPixelBufferPoolCreatePixelBuffer(NULL, adaptor.pixelBufferPool, &buffer) : kCVReturnError;
          if (status != kCVReturnSuccess || !buffer) { [input markAsFinished]; [writer cancelWriting]; reject(@"buffer_failed", @"Could not render Rewind. Please try again.", nil); return; }
          CVPixelBufferLockBaseAddress(buffer, 0);
          CGColorSpaceRef space = CGColorSpaceCreateDeviceRGB();
          CGContextRef context = CGBitmapContextCreate(CVPixelBufferGetBaseAddress(buffer), 720, 900, 8, CVPixelBufferGetBytesPerRow(buffer), space, kCGImageAlphaNoneSkipFirst);
          if (!context) { CGColorSpaceRelease(space); CVPixelBufferUnlockBaseAddress(buffer, 0); CVPixelBufferRelease(buffer); [input markAsFinished]; [writer cancelWriting]; reject(@"render_failed", @"Could not render Rewind.", nil); return; }
          CGContextDrawImage(context, CGRectMake(0, 0, 720, 900), image.CGImage);
          CGContextRelease(context); CGColorSpaceRelease(space); CVPixelBufferUnlockBaseAddress(buffer, 0);
          BOOL appended = [adaptor appendPixelBuffer:buffer withPresentationTime:CMTimeMake(frame, 60)];
          CVPixelBufferRelease(buffer);
          if (!appended) { [input markAsFinished]; [writer cancelWriting]; reject(@"frame_failed", @"Could not encode Rewind. Please try again.", nil); return; }
          frame++;
        }
      }
      if (frame == 600) {
        frame++; [input markAsFinished];
        [writer finishWritingWithCompletionHandler:^{
          if (writer.status == AVAssetWriterStatusCompleted) resolve([NSURL fileURLWithPath:path].absoluteString);
          else reject(@"rewind_failed", writer.error.localizedDescription ?: @"Rewind export failed.", writer.error);
        }];
      }
    }];
  }];
}
@end
