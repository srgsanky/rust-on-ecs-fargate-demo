use std::thread::sleep;
use std::time::Duration;

fn main() {
    loop {
        println!("Running benchmark..");
        sleep(Duration::new(10 /* sec */, 0));
    }
}
