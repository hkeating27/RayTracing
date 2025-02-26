var raytraceFS = `
struct Ray {
    vec3 pos;
    vec3 dir;
};

struct Material {
    vec3  k_d;  // diffuse coefficient
    vec3  k_s;  // specular coefficient
    float n;    // specular exponent
};

struct Sphere {
    vec3     center;
    float    radius;
    Material mtl;
};

struct Light {
    vec3 position;
    vec3 intensity;
};

struct HitInfo {
    float    t;
    vec3     position;
    vec3     normal;
    Material mtl;
};

uniform Sphere spheres[ NUM_SPHERES ];
uniform Light  lights [ NUM_LIGHTS  ];
uniform samplerCube envMap;
uniform int bounceLimit;

bool IntersectRay( inout HitInfo hit, Ray ray );

// Unified shading model to be used in both rasterization and ray tracing.
vec3 UnifiedShade(Material mtl, vec3 position, vec3 normal, vec3 view, vec3 lightPos, vec3 lightIntensity) {
    vec3 L = normalize(lightPos - position);
    vec3 H = normalize(L + view);
    float diff = max(dot(normal, L), 0.0);
    float spec = pow(max(dot(normal, H), 0.0), mtl.n);
    vec3 ambient = vec3(0.05); // Base ambient contribution
    vec3 color = (mtl.k_d * diff + mtl.k_s * spec) * lightIntensity + ambient;
    return clamp(color, 0.0, 1.0);
}

// Shades the given point and returns the computed color.
vec3 Shade( Material mtl, vec3 position, vec3 normal, vec3 view )
{
    vec3 color = vec3(0.0);
    for (int i = 0; i < NUM_LIGHTS; ++i) {
        // TO-DO: Check for shadows
        Ray shadowRay;
        shadowRay.dir = (lights[i].position - position);
		shadowRay.pos = position + normalize(shadowRay.dir) * 0.001; // Offset to avoid self-intersection

        HitInfo shadowHit;
        if (!IntersectRay(shadowHit, shadowRay) || shadowHit.t > 1.0) {
            // Perform shading using the Blinn model
            vec3 L = normalize(lights[i].position - position);
            vec3 H = normalize(L + view);
            float diff = max(dot(normal, L), 0.0);
            float spec = pow(max(dot(normal, H), 0.0), mtl.n); // Reduced specular intensity to avoid over-bright highlights
            vec3 ambient = vec3(0.0); // Unified ambient light to balance brightness in both modes
            color += (mtl.k_d * diff + mtl.k_s * spec) * lights[i].intensity + ambient;
        }
    }
    return color;
}

// Intersects the given ray with all spheres in the scene
// and updates the given HitInfo using the information of the sphere
// that first intersects with the ray.
// Returns true if an intersection is found.
bool IntersectRay( inout HitInfo hit, Ray ray )
{
    hit.t = 1e30;
    bool foundHit = false;
    for ( int i=0; i<NUM_SPHERES; ++i ) {
        // TO-DO: Test for ray-sphere intersection
        vec3 oc = ray.pos - spheres[i].center;
        float a = dot(ray.dir, ray.dir);
        float b = 2.0 * dot(oc, ray.dir);
        float c = dot(oc, oc) - (spheres[i].radius * spheres[i].radius);
        float discriminant = b * b - 4.0 * a * c;
        if (discriminant > 0.0) {
            float t1 = (-b - sqrt(discriminant)) / (2.0 * a);
            float t2 = (-b + sqrt(discriminant)) / (2.0 * a);

			float t = t1;
			if(t1 < 0.0){
				float t = t2;
			}
            if (t > 0.0 && t < hit.t) {
                hit.t = t;
                hit.position = ray.pos + t * ray.dir;
                hit.normal = normalize(hit.position - spheres[i].center);
                hit.mtl = spheres[i].mtl;
                foundHit = true;
            }
        }
    }
    return foundHit;
}

// Given a ray, returns the shaded color where the ray intersects a sphere.
// If the ray does not hit a sphere, returns the environment color.
vec4 RayTracer( Ray ray )
{
    HitInfo hit;
    if ( IntersectRay( hit, ray ) ) {
        vec3 view = normalize( -ray.dir );
        vec3 clr = Shade( hit.mtl, hit.position, hit.normal, view );

        // Compute reflections
        vec3 k_s = hit.mtl.k_s;
        for (int bounce = 0; bounce < MAX_BOUNCES; ++bounce) {
            if ( bounce >= bounceLimit ) break;
			if ( hit.mtl.k_s.r + hit.mtl.k_s.g + hit.mtl.k_s.b <= 0.0 ) break;

            Ray r;  // this is the reflection ray
            
            r.dir = reflect( -view, hit.normal );
			r.pos = hit.position + r.dir * 0.001; // Offset to avoid self-intersection
            HitInfo h;  // reflection hit info

            if ( IntersectRay( h, r ) ) {
                // TO-DO: Hit found, so shade the hit point
                clr += k_s * Shade(h.mtl, h.position, h.normal, normalize(-r.dir)); // Apply balanced reflection using the shading model
                 // Ensure minimum reflection contribution to avoid losing reflections
                
                
                
                // TO-DO: Update the loop variables for tracing the next reflection ray
                hit = h;
                k_s = max(k_s * hit.mtl.k_s, vec3(0.01)); // Apply stronger reflection decay to conserve energy across bounces
                view = normalize( -r.dir );
            } else {
                // The reflection ray did not intersect with anything,
                // so we are using the environment color
                clr += k_s * textureCube( envMap, r.dir.xzy ).rgb; // Further reduce environment reflection contribution for consistency and balance
                // no more reflections   
				break;				
            }
        }
        
        return vec4( clr, 1 );
          // return the accumulated color, including the reflections
    } else {
        return vec4( textureCube( envMap, ray.dir.xzy ).rgb, 1 );  // return the environment color
    }
}
`;
